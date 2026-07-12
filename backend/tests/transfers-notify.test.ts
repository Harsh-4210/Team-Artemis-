import { AllocationStatus, TransferStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allocationFindFirst: vi.fn(),
  allocationUpdateMany: vi.fn(),
  allocationCreate: vi.fn(),
  employeeFindUnique: vi.fn(),
  transferCreate: vi.fn(),
  transferFindUnique: vi.fn(),
  transferUpdate: vi.fn(),
  assetUpdate: vi.fn(),
  notificationCreate: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    allocation: {
      findFirst: mocks.allocationFindFirst,
      updateMany: mocks.allocationUpdateMany,
      create: mocks.allocationCreate,
    },
    employee: { findUnique: mocks.employeeFindUnique },
    transferRequest: {
      create: mocks.transferCreate,
      findUnique: mocks.transferFindUnique,
      update: mocks.transferUpdate,
    },
    asset: { update: mocks.assetUpdate },
    notification: { create: mocks.notificationCreate },
    $transaction: mocks.$transaction,
  },
}));

import {
  approveTransfer,
  rejectTransfer,
  requestTransfer,
} from "../src/modules/transfers/transfers.service";

const assetId = "11111111-1111-4111-8111-111111111111";
const fromId = "22222222-2222-4222-8222-222222222222";
const toId = "33333333-3333-4333-8333-333333333333";
const managerId = "44444444-4444-4444-8444-444444444444";
const transferId = "55555555-5555-4555-8555-555555555555";
const allocationId = "66666666-6666-4666-8666-666666666666";

describe("transfer request notifications and approval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("notifies the current holder when a transfer is requested", async () => {
    mocks.allocationFindFirst.mockResolvedValue({
      id: allocationId,
      employeeId: fromId,
      employee: { id: fromId, name: "Priya Employee", email: "priya@x.com" },
    });
    mocks.employeeFindUnique.mockResolvedValue({
      id: toId,
      status: "ACTIVE",
      name: "Raj Head",
    });
    mocks.transferCreate.mockResolvedValue({
      id: transferId,
      assetId,
      fromEmployeeId: fromId,
      toEmployeeId: toId,
      reason: "Need laptop for project",
      status: TransferStatus.REQUESTED,
      decisionNotes: null,
      approvedById: null,
      decidedAt: null,
      requestedAt: new Date(),
      asset: { id: assetId, assetTag: "AF-0001", name: "MacBook", status: "ALLOCATED" },
      fromEmployee: { id: fromId, name: "Priya Employee", email: "priya@x.com" },
      toEmployee: { id: toId, name: "Raj Head", email: "raj@x.com" },
      approvedBy: null,
    });
    mocks.notificationCreate.mockResolvedValue({ id: "n1" });

    await requestTransfer(
      {
        assetId,
        fromEmployeeId: fromId,
        toEmployeeId: toId,
        reason: "Need laptop for project",
      },
      { employeeId: managerId, role: "ASSET_MANAGER" },
    );

    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: fromId,
        type: "TRANSFER_REQUESTED",
        relatedEntityType: "TransferRequest",
        relatedEntityId: transferId,
      }),
    });
  });

  it("allows department heads to approve transfers and move custody", async () => {
    mocks.transferFindUnique.mockResolvedValue({
      id: transferId,
      assetId,
      fromEmployeeId: fromId,
      toEmployeeId: toId,
      reason: "Need laptop",
      status: TransferStatus.REQUESTED,
      asset: { id: assetId, assetTag: "AF-0001", name: "MacBook", status: "ALLOCATED" },
      fromEmployee: { id: fromId, name: "Priya", email: "p@x.com" },
      toEmployee: { id: toId, name: "Raj", email: "r@x.com" },
      approvedBy: null,
    });
    mocks.allocationFindFirst.mockResolvedValue({
      id: allocationId,
      employeeId: fromId,
      employee: { id: fromId, name: "Priya", email: "p@x.com" },
    });
    mocks.$transaction.mockImplementation(async (callback) =>
      callback({
        allocation: {
          updateMany: mocks.allocationUpdateMany,
          create: mocks.allocationCreate,
        },
        transferRequest: { update: mocks.transferUpdate },
        asset: { update: mocks.assetUpdate },
      }),
    );
    mocks.allocationUpdateMany.mockResolvedValue({ count: 1 });
    mocks.allocationCreate.mockResolvedValue({
      id: "new-alloc",
      assetId,
      employeeId: toId,
      status: AllocationStatus.ACTIVE,
      asset: true,
      employee: { id: toId, name: "Raj", email: "r@x.com" },
      allocatedBy: { id: managerId, name: "Head", email: "h@x.com" },
    });
    mocks.transferUpdate.mockResolvedValue({
      id: transferId,
      assetId,
      fromEmployeeId: fromId,
      toEmployeeId: toId,
      reason: "Need laptop",
      status: TransferStatus.COMPLETED,
      decisionNotes: null,
      approvedById: managerId,
      decidedAt: new Date(),
      requestedAt: new Date(),
      asset: { id: assetId, assetTag: "AF-0001", name: "MacBook", status: "ALLOCATED" },
      fromEmployee: { id: fromId, name: "Priya", email: "p@x.com" },
      toEmployee: { id: toId, name: "Raj", email: "r@x.com" },
      approvedBy: {
        id: managerId,
        name: "Head",
        email: "h@x.com",
        role: "DEPARTMENT_HEAD",
      },
    });
    mocks.notificationCreate.mockResolvedValue({ id: "n2" });

    await expect(
      approveTransfer(
        transferId,
        {},
        { employeeId: managerId, role: "DEPARTMENT_HEAD" },
      ),
    ).resolves.toMatchObject({
      transfer: { status: TransferStatus.COMPLETED },
    });

    expect(mocks.allocationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ employeeId: toId }),
      }),
    );
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        employeeId: toId,
        type: "TRANSFER_APPROVED",
      }),
    });
  });

  it("persists rejection reasons in decisionNotes", async () => {
    mocks.transferFindUnique.mockResolvedValue({
      id: transferId,
      assetId,
      fromEmployeeId: fromId,
      toEmployeeId: toId,
      reason: "Need laptop",
      status: TransferStatus.REQUESTED,
      asset: { id: assetId, assetTag: "AF-0001", name: "MacBook", status: "ALLOCATED" },
      fromEmployee: { id: fromId, name: "Priya", email: "p@x.com" },
      toEmployee: { id: toId, name: "Raj", email: "r@x.com" },
      approvedBy: null,
    });
    mocks.transferUpdate.mockResolvedValue({
      id: transferId,
      assetId,
      fromEmployeeId: fromId,
      toEmployeeId: toId,
      reason: "Need laptop",
      status: TransferStatus.REJECTED,
      decisionNotes: "Not justified",
      approvedById: managerId,
      decidedAt: new Date(),
      requestedAt: new Date(),
      asset: { id: assetId, assetTag: "AF-0001", name: "MacBook", status: "ALLOCATED" },
      fromEmployee: { id: fromId, name: "Priya", email: "p@x.com" },
      toEmployee: { id: toId, name: "Raj", email: "r@x.com" },
      approvedBy: {
        id: managerId,
        name: "Sarah",
        email: "s@x.com",
        role: "ASSET_MANAGER",
      },
    });
    mocks.notificationCreate.mockResolvedValue({ id: "n3" });

    await rejectTransfer(
      transferId,
      { reason: "Not justified" },
      { employeeId: managerId, role: "ASSET_MANAGER" },
    );

    expect(mocks.transferUpdate).toHaveBeenCalledWith({
      where: { id: transferId },
      data: expect.objectContaining({
        status: TransferStatus.REJECTED,
        decisionNotes: "Not justified",
      }),
      include: expect.any(Object),
    });
  });
});
