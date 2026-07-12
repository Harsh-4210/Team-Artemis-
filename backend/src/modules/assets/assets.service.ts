import {
  AssetCondition,
  AssetStatus,
  AllocationStatus,
  Prisma,
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import type {
  CreateAssetInput,
  ListAssetsQuery,
  UpdateAssetInput,
} from "./assets.schema";

const assetSummaryInclude = {
  category: { select: { id: true, name: true } },
  allocations: {
    where: { status: AllocationStatus.ACTIVE },
    orderBy: { allocatedAt: "desc" },
    take: 1,
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
    },
  },
} satisfies Prisma.AssetInclude;

const assetDetailInclude = {
  category: { select: { id: true, name: true, description: true } },
  allocations: {
    orderBy: { allocatedAt: "desc" },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
      allocatedBy: { select: { id: true, name: true, email: true } },
    },
  },
  maintenanceRequests: {
    orderBy: { createdAt: "desc" },
    include: {
      raisedBy: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true, role: true } },
      assignedTechnician: { select: { id: true, name: true, email: true } },
    },
  },
  transferRequests: {
    orderBy: { requestedAt: "desc" },
    include: {
      fromEmployee: { select: { id: true, name: true, email: true } },
      toEmployee: { select: { id: true, name: true, email: true } },
      approvedBy: { select: { id: true, name: true, email: true, role: true } },
    },
  },
} satisfies Prisma.AssetInclude;

type AssetSummaryRow = Prisma.AssetGetPayload<{
  include: typeof assetSummaryInclude;
}>;
type AssetDetailRow = Prisma.AssetGetPayload<{
  include: typeof assetDetailInclude;
}>;

async function ensureAssetTagSequence() {
  await prisma.$executeRaw`CREATE SEQUENCE IF NOT EXISTS asset_tag_sequence START WITH 1 INCREMENT BY 1`;
}

/** Align the Postgres sequence with existing AF-#### tags (used by seed). */
export async function syncAssetTagSequence() {
  await ensureAssetTagSequence();
  const rows = await prisma.$queryRaw<{ maxTag: string | null }[]>`
    SELECT MAX("assetTag") AS "maxTag"
    FROM "Asset"
    WHERE "assetTag" ~ '^AF-[0-9]+$'
  `;
  const maxTag = rows[0]?.maxTag ?? null;
  const match = maxTag?.match(/^AF-(\d+)$/);
  const highWater = match ? Number(match[1]) : 0;
  if (highWater > 0) {
    await prisma.$executeRaw`SELECT setval('asset_tag_sequence', ${highWater}, true)`;
  } else {
    await prisma.$executeRaw`SELECT setval('asset_tag_sequence', 1, false)`;
  }
}

async function nextAssetTag() {
  await ensureAssetTagSequence();
  const [row] = await prisma.$queryRaw<
    { value: number }[]
  >`SELECT nextval('asset_tag_sequence')::int AS value`;
  if (!row) {
    throw new AppError(
      500,
      "ASSET_TAG_GENERATION_FAILED",
      "Could not generate an asset tag",
    );
  }
  return `AF-${String(row.value).padStart(4, "0")}`;
}

function serializeCategory(category: { id: string; name: string } | null) {
  return category ? { id: category.id, name: category.name } : null;
}

function serializeEmployee(employee: {
  id: string;
  name: string;
  email: string;
  department: { id: string; name: string; code: string } | null;
}) {
  return {
    id: employee.id,
    name: employee.name,
    email: employee.email,
    department: employee.department,
  };
}

function serializeAllocation(
  allocation: AssetDetailRow["allocations"][number],
) {
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
    employee: serializeEmployee(allocation.employee),
    allocatedBy: allocation.allocatedBy,
  };
}

function serializeAssetSummary(asset: AssetSummaryRow) {
  const currentAllocation = asset.allocations[0] ?? null;
  return {
    id: asset.id,
    assetTag: asset.assetTag,
    name: asset.name,
    serialNumber: asset.serialNumber,
    acquisitionDate: asset.acquisitionDate,
    acquisitionCost: asset.acquisitionCost.toString(),
    condition: asset.condition,
    location: asset.location,
    photoUrl: asset.photoUrl,
    isBookable: asset.isBookable,
    status: asset.status,
    customData: asset.customData,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    category: serializeCategory(asset.category),
    currentAllocation: currentAllocation
      ? {
          id: currentAllocation.id,
          employee: serializeEmployee(currentAllocation.employee),
          allocatedAt: currentAllocation.allocatedAt,
          expectedReturnDate: currentAllocation.expectedReturnDate,
        }
      : null,
    currentHolder: currentAllocation?.employee ?? null,
  };
}

function serializeAssetDetail(asset: AssetDetailRow) {
  return {
    ...serializeAssetSummary(asset as AssetSummaryRow),
    category: asset.category,
    allocations: asset.allocations.map(serializeAllocation),
    maintenanceRequests: asset.maintenanceRequests,
    transferRequests: asset.transferRequests,
  };
}

async function getActiveAllocation(assetId: string) {
  return prisma.allocation.findFirst({
    where: { assetId, status: AllocationStatus.ACTIVE },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          email: true,
          department: { select: { id: true, name: true, code: true } },
        },
      },
    },
    orderBy: { allocatedAt: "desc" },
  });
}

export async function listAssets(query: ListAssetsQuery) {
  const where: Prisma.AssetWhereInput = {
    status: query.status,
    categoryId: query.categoryId,
    location: query.location
      ? { contains: query.location, mode: "insensitive" }
      : undefined,
    AND: query.search
      ? [
          {
            OR: [
              { assetTag: { contains: query.search, mode: "insensitive" } },
              { name: { contains: query.search, mode: "insensitive" } },
              { serialNumber: { contains: query.search, mode: "insensitive" } },
            ],
          },
        ]
      : undefined,
    allocations: query.departmentId
      ? {
          some: {
            status: AllocationStatus.ACTIVE,
            employee: { departmentId: query.departmentId },
          },
        }
      : undefined,
  };

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    prisma.asset.findMany({
      where,
      include: assetSummaryInclude,
      orderBy: [{ createdAt: "desc" }],
      skip,
      take: query.limit,
    }),
    prisma.asset.count({ where }),
  ]);

  return {
    items: items.map(serializeAssetSummary),
    pagination: {
      page: query.page,
      limit: query.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.limit)),
    },
  };
}

export async function getAssetById(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    include: assetDetailInclude,
  });
  if (!asset) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset not found");
  }
  return serializeAssetDetail(asset);
}

export async function createAsset(input: CreateAssetInput) {
  const category = await prisma.assetCategory.findUnique({
    where: { id: input.categoryId },
    select: { id: true },
  });
  if (!category) {
    throw new AppError(
      404,
      "CATEGORY_NOT_FOUND",
      "The selected category does not exist",
    );
  }

  const assetTag = await nextAssetTag();

  const asset = await prisma.asset.create({
    data: {
      assetTag,
      name: input.name,
      categoryId: input.categoryId,
      serialNumber: input.serialNumber ?? null,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost: new Prisma.Decimal(input.acquisitionCost),
      condition: input.condition ?? AssetCondition.GOOD,
      location: input.location,
      photoUrl: input.photoUrl ?? null,
      isBookable: input.isBookable ?? false,
      customData: input.customData as Prisma.InputJsonValue,
      status: input.status ?? AssetStatus.AVAILABLE,
    },
    include: assetSummaryInclude,
  });

  return serializeAssetSummary(asset as AssetSummaryRow);
}

export async function updateAsset(id: string, input: UpdateAssetInput) {
  const existing = await prisma.asset.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!existing) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset not found");
  }

  if (input.categoryId) {
    const category = await prisma.assetCategory.findUnique({
      where: { id: input.categoryId },
      select: { id: true },
    });
    if (!category) {
      throw new AppError(
        404,
        "CATEGORY_NOT_FOUND",
        "The selected category does not exist",
      );
    }
  }

  const asset = await prisma.asset.update({
    where: { id },
    data: {
      name: input.name,
      categoryId: input.categoryId,
      serialNumber: input.serialNumber ?? undefined,
      acquisitionDate: input.acquisitionDate,
      acquisitionCost:
        typeof input.acquisitionCost === "number"
          ? new Prisma.Decimal(input.acquisitionCost)
          : undefined,
      condition: input.condition,
      location: input.location,
      photoUrl: input.photoUrl ?? undefined,
      isBookable: input.isBookable,
      customData: input.customData as Prisma.InputJsonValue,
      status: input.status,
    },
    include: assetSummaryInclude,
  });

  return serializeAssetSummary(asset as AssetSummaryRow);
}

export async function deleteAsset(id: string) {
  const asset = await prisma.asset.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!asset) {
    throw new AppError(404, "ASSET_NOT_FOUND", "Asset not found");
  }
  if (asset.status === AssetStatus.ALLOCATED) {
    throw new AppError(
      409,
      "ASSET_ALLOCATED",
      "Allocated assets cannot be deleted",
    );
  }

  await prisma.asset.delete({ where: { id } });
}

export async function getCurrentAllocationSnapshot(assetId: string) {
  const allocation = await getActiveAllocation(assetId);
  return allocation
    ? {
        id: allocation.id,
        assetId: allocation.assetId,
        employee: allocation.employee,
        employeeId: allocation.employeeId,
      }
    : null;
}
