import { AllocationStatus, AssetStatus, Prisma } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import type {
  CreateAllocationInput,
  ListAllocationsQuery,
  ReturnAllocationInput,
} from "./allocations.schema";

const allocationInclude = {
  asset: {
    select: {
      id: true,
      assetTag: true,
      name: true,
      location: true,
      status: true,
      category: { select: { id: true, name: true } },
    },
  },
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
  allocatedBy: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AllocationInclude;

type AllocationRow = Prisma.AllocationGetPayload<{
  include: typeof allocationInclude;
}>;

const MANAGER_ROLES = new Set(["ADMIN", "ASSET_MANAGER"]);

function serializeAllocation(allocation: AllocationRow) {
  return {
    id: allocation.id,
    assetId: allocation.assetId,
    employeeId: allocation.employeeId,
    allocatedAt: allocation.allocatedAt,
    expectedReturnDate: allocation.expectedReturnDate,
    returnedAt: allocation.returnedAt,
    conditionOnReturn: allocation.conditionOnReturn,
    notes: allocation.notes,
    status: allocation.status,
    allocatedById: allocation.allocatedById,
    createdAt: allocation.createdAt,
    asset: allocation.asset,
    employee: allocation.employee,
    allocatedBy: allocation.allocatedBy,
  };
}

async function assertEmployeeActive(employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, status: true, name: true },
  });
  if (!employee) {
    throw new AppError(
      404,
      "EMPLOYEE_NOT_FOUND",
      "The selected employee does not exist",
    );
  }
  if (employee.status !== "ACTIVE") {
    throw new AppError(
      400,
      "EMPLOYEE_INACTIVE",
      "The selected employee is not active",
    );
  }
  return employee;
}

async function currentAllocationWithEmployee(assetId: string) {
  return prisma.allocation.findFirst({
    where: {
      assetId,
      status: { in: [AllocationStatus.ACTIVE, AllocationStatus.OVERDUE] },
    },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: { allocatedAt: "desc" },
  });
}

function isManager(role: string) {
  return MANAGER_ROLES.has(role);
}

export async function markOverdueAllocations() {
  const now = new Date();
  const result = await prisma.allocation.updateMany({
    where: {
      status: AllocationStatus.ACTIVE,
      expectedReturnDate: { lt: now },
    },
    data: { status: AllocationStatus.OVERDUE },
  });
  return { updated: result.count };
}

export async function listAllocations(
  query: ListAllocationsQuery,
  actor: { employeeId: string; role: string },
) {
  if (query.status === AllocationStatus.OVERDUE) {
    await markOverdueAllocations();
  }

  const now = new Date();
  const where: Prisma.AllocationWhereInput = {
    assetId: query.assetId,
    employeeId: query.employeeId,
    ...(query.scope === "mine" ||
    (!isManager(actor.role) && query.scope !== "all")
      ? { employeeId: actor.employeeId }
      : {}),
    ...(query.status === AllocationStatus.OVERDUE
      ? { status: AllocationStatus.OVERDUE }
      : query.status
        ? { status: query.status }
        : {}),
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.allocation.findMany({
      where,
      include: allocationInclude,
      orderBy: [{ allocatedAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.allocation.count({ where }),
  ]);

  return {
    items: items.map((allocation) => ({
      ...serializeAllocation(allocation),
      isOverdue:
        allocation.status === AllocationStatus.OVERDUE ||
        (allocation.status === AllocationStatus.ACTIVE &&
          Boolean(
            allocation.expectedReturnDate &&
              allocation.expectedReturnDate < now,
          )),
    })),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function listOverdueAllocations(actor: {
  employeeId: string;
  role: string;
}) {
  await markOverdueAllocations();
  return listAllocations(
    { status: AllocationStatus.OVERDUE, page: 1, limit: 100 },
    actor,
  );
}

export async function allocateAsset(
  input: CreateAllocationInput,
  actor: { employeeId: string; role: string },
) {
  if (!isManager(actor.role)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only asset managers can allocate assets",
    );
  }

  const [asset, employee] = await Promise.all([
    prisma.asset.findUnique({
      where: { id: input.assetId },
      select: { id: true, assetTag: true, name: true, status: true },
    }),
    assertEmployeeActive(input.employeeId),
  ]);

  if (!asset) {
    throw new AppError(
      404,
      "ASSET_NOT_FOUND",
      "The selected asset does not exist",
    );
  }

  const activeAllocation = await currentAllocationWithEmployee(asset.id);

  if (asset.status === AssetStatus.ALLOCATED || activeAllocation) {
    throw new AppError(
      409,
      "ASSET_ALREADY_ALLOCATED",
      "The asset is already allocated",
      {
        assetId: asset.id,
        allocationId: activeAllocation?.id ?? null,
        currentHolderId: activeAllocation?.employee?.id ?? null,
        currentHolder: activeAllocation?.employee?.name ?? null,
      },
    );
  }

  if (asset.status !== AssetStatus.AVAILABLE) {
    throw new AppError(
      409,
      "ASSET_NOT_AVAILABLE",
      `The asset is not available for allocation (status: ${asset.status})`,
      {
        assetId: asset.id,
        status: asset.status,
      },
    );
  }

  const allocation = await prisma.$transaction(async (tx) => {
    const updated = await tx.asset.updateMany({
      where: { id: asset.id, status: AssetStatus.AVAILABLE },
      data: { status: AssetStatus.ALLOCATED },
    });

    if (updated.count === 0) {
      const current = await tx.allocation.findFirst({
        where: {
          assetId: asset.id,
          status: { in: [AllocationStatus.ACTIVE, AllocationStatus.OVERDUE] },
        },
        include: {
          employee: { select: { id: true, name: true, email: true } },
        },
      });
      throw new AppError(
        409,
        "ASSET_ALREADY_ALLOCATED",
        "The asset is already allocated",
        {
          assetId: asset.id,
          allocationId: current?.id ?? null,
          currentHolderId: current?.employee?.id ?? null,
          currentHolder: current?.employee?.name ?? null,
        },
      );
    }

    return tx.allocation.create({
      data: {
        assetId: asset.id,
        employeeId: employee.id,
        allocatedById: actor.employeeId,
        expectedReturnDate: input.expectedReturnDate ?? null,
        notes: input.notes,
        status: AllocationStatus.ACTIVE,
      },
      include: allocationInclude,
    });
  });

  return serializeAllocation(allocation);
}

export async function returnAllocation(
  id: string,
  input: ReturnAllocationInput,
  actor: { employeeId: string; role: string },
) {
  const allocation = await prisma.allocation.findUnique({
    where: { id },
    include: { asset: true },
  });

  if (!allocation) {
    throw new AppError(404, "ALLOCATION_NOT_FOUND", "Allocation not found");
  }

  const canManage = isManager(actor.role);
  const ownsAllocation = allocation.employeeId === actor.employeeId;
  if (!canManage && !ownsAllocation) {
    throw new AppError(403, "FORBIDDEN", "You cannot return this allocation");
  }

  const returnable = new Set<AllocationStatus>([
    AllocationStatus.ACTIVE,
    AllocationStatus.OVERDUE,
  ]);
  if (!returnable.has(allocation.status)) {
    throw new AppError(
      409,
      "ALLOCATION_NOT_ACTIVE",
      "Only active or overdue allocations can be returned",
    );
  }

  return prisma
    .$transaction(async (tx) => {
      const updated = await tx.allocation.updateMany({
        where: {
          id,
          status: { in: [AllocationStatus.ACTIVE, AllocationStatus.OVERDUE] },
        },
        data: {
          status: AllocationStatus.RETURNED,
          returnedAt: new Date(),
          conditionOnReturn: input.conditionOnReturn ?? null,
          notes: input.notes ?? allocation.notes,
        },
      });

      if (updated.count === 0) {
        throw new AppError(
          409,
          "ALLOCATION_NOT_ACTIVE",
          "Only active or overdue allocations can be returned",
        );
      }

      await tx.asset.update({
        where: { id: allocation.assetId },
        data: { status: AssetStatus.AVAILABLE },
      });

      const returned = await tx.allocation.findUnique({
        where: { id },
        include: allocationInclude,
      });

      if (!returned) {
        throw new AppError(
          500,
          "ALLOCATION_RETURN_FAILED",
          "The allocation could not be updated",
        );
      }

      return returned;
    })
    .then(serializeAllocation);
}
