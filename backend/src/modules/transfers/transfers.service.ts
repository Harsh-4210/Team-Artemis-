import {
  AllocationStatus,
  AssetStatus,
  TransferStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { notify } from "../notifications/notify";
import type {
  CreateTransferInput,
  ListTransfersQuery,
  RejectTransferInput,
  TransferDecisionInput,
} from "./transfers.schema";

const transferInclude = {
  asset: { select: { id: true, assetTag: true, name: true, status: true } },
  fromEmployee: { select: { id: true, name: true, email: true } },
  toEmployee: { select: { id: true, name: true, email: true } },
  approvedBy: { select: { id: true, name: true, email: true, role: true } },
} satisfies Prisma.TransferRequestInclude;

type TransferRow = Prisma.TransferRequestGetPayload<{
  include: typeof transferInclude;
}>;

function serializeTransfer(transfer: TransferRow) {
  return transfer;
}

const APPROVER_ROLES = new Set(["ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"]);
const MANAGER_ROLES = new Set(["ADMIN", "ASSET_MANAGER"]);

async function currentAllocation(assetId: string) {
  return prisma.allocation.findFirst({
    where: {
      assetId,
      status: { in: [AllocationStatus.ACTIVE, AllocationStatus.OVERDUE] },
    },
    include: { employee: { select: { id: true, name: true, email: true } } },
    orderBy: { allocatedAt: "desc" },
  });
}

export async function listTransfers(
  query: ListTransfersQuery,
  actor: { employeeId: string; role: string },
) {
  const canSeeAll = APPROVER_ROLES.has(actor.role);
  const where: Prisma.TransferRequestWhereInput = {
    status: query.status,
    assetId: query.assetId,
    ...(canSeeAll
      ? {}
      : {
          OR: [
            { fromEmployeeId: actor.employeeId },
            { toEmployeeId: actor.employeeId },
          ],
        }),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.transferRequest.findMany({
      where,
      include: transferInclude,
      orderBy: [{ requestedAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.transferRequest.count({ where }),
  ]);

  return {
    items: items.map(serializeTransfer),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function requestTransfer(
  input: CreateTransferInput,
  actor: { employeeId: string; role: string },
) {
  const allocation = await currentAllocation(input.assetId);
  if (!allocation) {
    throw new AppError(
      409,
      "ASSET_NOT_ALLOCATED",
      "The asset is not currently allocated",
    );
  }
  if (allocation.employeeId !== input.fromEmployeeId) {
    throw new AppError(
      409,
      "TRANSFER_MISMATCH",
      "The selected employee does not currently hold this asset",
      {
        currentHolderId: allocation.employee.id,
        currentHolder: allocation.employee.name,
        allocationId: allocation.id,
        assetId: input.assetId,
      },
    );
  }

  const target = await prisma.employee.findUnique({
    where: { id: input.toEmployeeId },
    select: { id: true, status: true, name: true },
  });
  if (!target || target.status !== "ACTIVE") {
    throw new AppError(
      400,
      "INVALID_TRANSFER_TARGET",
      "The transfer target must be an active employee",
    );
  }

  const requesterIsHolder = actor.employeeId === input.fromEmployeeId;
  const managerCanAct = MANAGER_ROLES.has(actor.role);
  if (!requesterIsHolder && !managerCanAct) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You cannot request a transfer for another employee",
    );
  }

  const transfer = await prisma.transferRequest.create({
    data: {
      assetId: input.assetId,
      fromEmployeeId: input.fromEmployeeId,
      toEmployeeId: input.toEmployeeId,
      reason: input.reason,
      status: TransferStatus.REQUESTED,
    },
    include: transferInclude,
  });

  await notify({
    employeeId: input.fromEmployeeId,
    type: "TRANSFER_REQUESTED",
    title: "Transfer requested for your asset",
    message: `${target.name} requested transfer of ${transfer.asset.assetTag} · ${transfer.asset.name}. Reason: ${input.reason}`,
    relatedEntityType: "TransferRequest",
    relatedEntityId: transfer.id,
  });

  return serializeTransfer(transfer);
}

export async function approveTransfer(
  id: string,
  input: TransferDecisionInput,
  actor: { employeeId: string; role: string },
) {
  if (!APPROVER_ROLES.has(actor.role)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only asset managers or department heads can approve transfers",
    );
  }

  const transfer = await prisma.transferRequest.findUnique({
    where: { id },
    include: transferInclude,
  });

  if (!transfer) {
    throw new AppError(404, "TRANSFER_NOT_FOUND", "Transfer request not found");
  }
  if (transfer.status !== TransferStatus.REQUESTED) {
    throw new AppError(
      409,
      "TRANSFER_LOCKED",
      "Only requested transfers can be approved",
    );
  }

  const activeAllocation = await currentAllocation(transfer.assetId);
  if (
    !activeAllocation ||
    activeAllocation.employeeId !== transfer.fromEmployeeId
  ) {
    throw new AppError(
      409,
      "TRANSFER_MISMATCH",
      "The transfer no longer matches the current holder",
    );
  }

  const approved = await prisma.$transaction(async (tx) => {
    await tx.allocation.updateMany({
      where: {
        id: activeAllocation.id,
        status: { in: [AllocationStatus.ACTIVE, AllocationStatus.OVERDUE] },
      },
      data: {
        status: AllocationStatus.RETURNED,
        returnedAt: new Date(),
        notes: input.notes,
      },
    });

    const allocation = await tx.allocation.create({
      data: {
        assetId: transfer.assetId,
        employeeId: transfer.toEmployeeId,
        allocatedById: actor.employeeId,
        status: AllocationStatus.ACTIVE,
        notes: input.notes,
      },
      include: {
        asset: true,
        employee: { select: { id: true, name: true, email: true } },
        allocatedBy: { select: { id: true, name: true, email: true } },
      },
    });

    const updated = await tx.transferRequest.update({
      where: { id },
      data: {
        status: TransferStatus.COMPLETED,
        approvedById: actor.employeeId,
        decisionNotes: input.notes,
        decidedAt: new Date(),
      },
      include: transferInclude,
    });

    await tx.asset.update({
      where: { id: transfer.assetId },
      data: { status: AssetStatus.ALLOCATED },
    });

    return { allocation, transfer: updated };
  });

  await notify({
    employeeId: transfer.toEmployeeId,
    type: "TRANSFER_APPROVED",
    title: "Asset transfer approved",
    message: `${approved.transfer.asset.assetTag} · ${approved.transfer.asset.name} is now allocated to you.`,
    relatedEntityType: "TransferRequest",
    relatedEntityId: approved.transfer.id,
  });

  return {
    transfer: serializeTransfer(approved.transfer),
    allocation: approved.allocation,
  };
}

export async function rejectTransfer(
  id: string,
  input: RejectTransferInput,
  actor: { employeeId: string; role: string },
) {
  if (!APPROVER_ROLES.has(actor.role)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only asset managers or department heads can reject transfers",
    );
  }

  const transfer = await prisma.transferRequest.findUnique({
    where: { id },
    include: transferInclude,
  });
  if (!transfer) {
    throw new AppError(404, "TRANSFER_NOT_FOUND", "Transfer request not found");
  }
  if (transfer.status !== TransferStatus.REQUESTED) {
    throw new AppError(
      409,
      "TRANSFER_LOCKED",
      "Only requested transfers can be rejected",
    );
  }

  const updated = await prisma.transferRequest.update({
    where: { id },
    data: {
      status: TransferStatus.REJECTED,
      decidedAt: new Date(),
      approvedById: actor.employeeId,
      decisionNotes: input.reason,
    },
    include: transferInclude,
  });

  await notify({
    employeeId: transfer.toEmployeeId,
    type: "TRANSFER_REJECTED",
    title: "Asset transfer rejected",
    message: `Transfer of ${transfer.asset.assetTag} · ${transfer.asset.name} was rejected. Reason: ${input.reason}`,
    relatedEntityType: "TransferRequest",
    relatedEntityId: transfer.id,
  });

  return serializeTransfer(updated);
}
