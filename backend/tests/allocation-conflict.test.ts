import { AllocationStatus, AssetStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  assetFindUnique: vi.fn(),
  assetUpdateMany: vi.fn(),
  employeeFindUnique: vi.fn(),
  allocationFindFirst: vi.fn(),
  allocationCreate: vi.fn(),
  allocationUpdateMany: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    asset: {
      findUnique: mocks.assetFindUnique,
      updateMany: mocks.assetUpdateMany,
    },
    employee: { findUnique: mocks.employeeFindUnique },
    allocation: {
      findFirst: mocks.allocationFindFirst,
      create: mocks.allocationCreate,
      updateMany: mocks.allocationUpdateMany,
    },
    $transaction: mocks.$transaction,
  },
}));

import { allocateAsset } from "../src/modules/allocations/allocations.service";

const assetId = "11111111-1111-4111-8111-111111111111";
const employeeId = "22222222-2222-4222-8222-222222222222";
const managerId = "33333333-3333-4333-8333-333333333333";
const holderId = "44444444-4444-4444-8444-444444444444";
const allocationId = "55555555-5555-4555-8555-555555555555";

describe("allocateAsset conflict handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.employeeFindUnique.mockResolvedValue({
      id: employeeId,
      status: "ACTIVE",
      name: "Raj Head",
    });
  });

  it("returns 409 with currentHolder when the asset is already allocated", async () => {
    mocks.assetFindUnique.mockResolvedValue({
      id: assetId,
      assetTag: "AF-0001",
      name: "MacBook",
      status: AssetStatus.ALLOCATED,
    });
    mocks.allocationFindFirst.mockResolvedValue({
      id: allocationId,
      employeeId: holderId,
      employee: { id: holderId, name: "Priya Employee", email: "priya@x.com" },
    });

    await expect(
      allocateAsset(
        { assetId, employeeId },
        { employeeId: managerId, role: "ASSET_MANAGER" },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ASSET_ALREADY_ALLOCATED",
      details: {
        allocationId,
        currentHolder: "Priya Employee",
        currentHolderId: holderId,
        assetId,
      },
    });
  });

  it("returns ASSET_NOT_AVAILABLE for non-allocatable statuses", async () => {
    mocks.assetFindUnique.mockResolvedValue({
      id: assetId,
      assetTag: "AF-0001",
      name: "MacBook",
      status: AssetStatus.UNDER_MAINTENANCE,
    });
    mocks.allocationFindFirst.mockResolvedValue(null);

    await expect(
      allocateAsset(
        { assetId, employeeId },
        { employeeId: managerId, role: "ASSET_MANAGER" },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: "ASSET_NOT_AVAILABLE",
    });
  });

  it("creates an allocation when the asset is available", async () => {
    mocks.assetFindUnique.mockResolvedValue({
      id: assetId,
      assetTag: "AF-0001",
      name: "MacBook",
      status: AssetStatus.AVAILABLE,
    });
    mocks.allocationFindFirst.mockResolvedValue(null);
    mocks.$transaction.mockImplementation(async (callback) =>
      callback({
        asset: { updateMany: mocks.assetUpdateMany },
        allocation: { create: mocks.allocationCreate },
      }),
    );
    mocks.assetUpdateMany.mockResolvedValue({ count: 1 });
    mocks.allocationCreate.mockResolvedValue({
      id: allocationId,
      assetId,
      employeeId,
      allocatedAt: new Date(),
      expectedReturnDate: null,
      returnedAt: null,
      conditionOnReturn: null,
      notes: null,
      status: AllocationStatus.ACTIVE,
      allocatedById: managerId,
      createdAt: new Date(),
      asset: {
        id: assetId,
        assetTag: "AF-0001",
        name: "MacBook",
        location: "IT",
        status: AssetStatus.ALLOCATED,
        category: { id: "c1", name: "Electronics" },
      },
      employee: {
        id: employeeId,
        name: "Raj Head",
        email: "raj@x.com",
        department: null,
      },
      allocatedBy: {
        id: managerId,
        name: "Sarah",
        email: "sarah@x.com",
      },
    });

    await expect(
      allocateAsset(
        { assetId, employeeId },
        { employeeId: managerId, role: "ASSET_MANAGER" },
      ),
    ).resolves.toMatchObject({
      id: allocationId,
      status: AllocationStatus.ACTIVE,
    });
  });
});
