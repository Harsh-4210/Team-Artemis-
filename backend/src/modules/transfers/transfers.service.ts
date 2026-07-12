import {
  AllocationStatus,
  AssetStatus,
  TransferStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import type {
  CreateTransferInput,
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

const MANAGER_ROLES = new Set(["ADMIN", "ASSET_MANAGER"]);

async function currentAllocation(assetId: string) {
  return prisma.allocation.findFirst({
    where: { assetId, status: AllocationStatus.ACTIVE },
    include: { employee: { select: { id: true, name: true, email: true } } },
    orderBy: { allocatedAt: "desc" },
  });
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
    select: { id: true, status: true },
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

  return prisma.transferRequest
    .create({
      data: {
        assetId: input.assetId,
        fromEmployeeId: input.fromEmployeeId,
        toEmployeeId: input.toEmployeeId,
        reason: input.reason,
        status: TransferStatus.REQUESTED,
      },
      include: transferInclude,
    })
    .then(serializeTransfer);
}

export async function approveTransfer(
  id: string,
  input: TransferDecisionInput,
  actor: { employeeId: string; role: string },
) {
  if (!MANAGER_ROLES.has(actor.role)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only asset managers can approve transfers",
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
      where: { id: activeAllocation.id, status: AllocationStatus.ACTIVE },
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
  if (!MANAGER_ROLES.has(actor.role)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only asset managers can reject transfers",
    );
  }

  const transfer = await prisma.transferRequest.findUnique({ where: { id } });
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

  return prisma.transferRequest
    .update({
      where: { id },
      data: {
        status: TransferStatus.REJECTED,
        decidedAt: new Date(),
        approvedById: actor.employeeId,
      },
      include: transferInclude,
    })
    .then(serializeTransfer);
}
