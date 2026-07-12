import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auditCycleCreate: vi.fn(),
  auditCycleFindMany: vi.fn(),
  auditCycleFindUnique: vi.fn(),
  auditCycleUpdate: vi.fn(),
  auditAssignmentFindMany: vi.fn(),
  auditAssignmentCreateMany: vi.fn(),
  auditRecordFindUnique: vi.fn(),
  auditRecordUpdate: vi.fn(),
  auditRecordCreateMany: vi.fn(),
  departmentFindUnique: vi.fn(),
  employeeFindMany: vi.fn(),
  assetFindMany: vi.fn(),
  assetUpdate: vi.fn(),
  maintenanceRequestCreate: vi.fn(),
  notificationCreate: vi.fn(),
  $transaction: vi.fn(),
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    auditCycle: {
      create: mocks.auditCycleCreate,
      findMany: mocks.auditCycleFindMany,
      findUnique: mocks.auditCycleFindUnique,
      update: mocks.auditCycleUpdate,
    },
    auditAssignment: {
      findMany: mocks.auditAssignmentFindMany,
      createMany: mocks.auditAssignmentCreateMany,
    },
    auditRecord: {
      findUnique: mocks.auditRecordFindUnique,
      update: mocks.auditRecordUpdate,
      createMany: mocks.auditRecordCreateMany,
    },
    department: { findUnique: mocks.departmentFindUnique },
    employee: { findMany: mocks.employeeFindMany },
    asset: { findMany: mocks.assetFindMany, update: mocks.assetUpdate },
    maintenanceRequest: { create: mocks.maintenanceRequestCreate },
    notification: { create: mocks.notificationCreate },
    $transaction: mocks.$transaction,
  },
}));

import {
  activateAuditCycle,
  assignAuditors,
  closeAuditCycle,
  createAuditCycle,
  recordAuditStatus,
} from "../src/modules/audits/audits.service";
import { createAuditCycleSchema } from "../src/modules/audits/audits.schema";

const cycleId = "11111111-1111-4111-8111-111111111111";
const deptId = "22222222-2222-4222-8222-222222222222";
const adminId = "33333333-3333-4333-8333-333333333333";
const auditorId = "44444444-4444-4444-8444-444444444444";
const auditorBId = "55555555-5555-4555-8555-555555555555";
const employeeInDeptId = "66666666-6666-4666-8666-666666666666";
const recordId = "77777777-7777-4777-8777-777777777777";
const assetAId = "88888888-8888-4888-8888-888888888888";
const assetBId = "99999999-9999-4999-8999-999999999999";
const assetCId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const assetDId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

describe("audit cycle schema", () => {
  it("rejects an end date on or before the start date", () => {
    const result = createAuditCycleSchema.safeParse({
      name: "Engineering Audit",
      startDate: "2026-08-10",
      endDate: "2026-08-01",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a valid date range with no scope", () => {
    const result = createAuditCycleSchema.safeParse({
      name: "Org-wide Audit",
      startDate: "2026-08-01",
      endDate: "2026-08-10",
    });
    expect(result.success).toBe(true);
  });
});

describe("createAuditCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a scope department that does not exist", async () => {
    mocks.departmentFindUnique.mockResolvedValue(null);

    await expect(
      createAuditCycle(
        {
          name: "Engineering Audit",
          scopeDepartmentId: deptId,
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-10"),
        },
        { employeeId: adminId },
      ),
    ).rejects.toMatchObject({ statusCode: 400, code: "INVALID_SCOPE_DEPARTMENT" });
  });

  it("creates a draft cycle when the scope department exists", async () => {
    mocks.departmentFindUnique.mockResolvedValue({ id: deptId });
    mocks.auditCycleCreate.mockResolvedValue({ id: cycleId, status: "DRAFT" });

    await expect(
      createAuditCycle(
        {
          name: "Engineering Audit",
          scopeDepartmentId: deptId,
          startDate: new Date("2026-08-01"),
          endDate: new Date("2026-08-10"),
        },
        { employeeId: adminId },
      ),
    ).resolves.toMatchObject({ status: "DRAFT" });
  });
});

describe("assignAuditors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("assigns only the not-yet-assigned auditors and notifies just those", async () => {
    mocks.auditCycleFindUnique
      .mockResolvedValueOnce({ id: cycleId, status: "DRAFT", name: "Engineering Audit" })
      .mockResolvedValueOnce({
        id: cycleId,
        status: "DRAFT",
        name: "Engineering Audit",
        scopeDepartment: null,
        createdBy: { id: adminId, name: "Admin", email: "admin@x.com" },
        assignments: [
          { auditorId, auditor: { id: auditorId, name: "Auditor A", email: "a@x.com" } },
          { auditorId: auditorBId, auditor: { id: auditorBId, name: "Auditor B", email: "b@x.com" } },
        ],
        records: [],
      });
    mocks.employeeFindMany.mockResolvedValue([
      { id: auditorId, status: "ACTIVE" },
      { id: auditorBId, status: "ACTIVE" },
    ]);
    mocks.auditAssignmentFindMany.mockResolvedValue([{ auditorId }]);
    mocks.auditAssignmentCreateMany.mockResolvedValue({ count: 1 });
    mocks.notificationCreate.mockResolvedValue({ id: "n1" });

    await assignAuditors(cycleId, { auditorIds: [auditorId, auditorBId] });

    expect(mocks.auditAssignmentCreateMany).toHaveBeenCalledWith({
      data: [{ auditCycleId: cycleId, auditorId: auditorBId }],
      skipDuplicates: true,
    });
    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ employeeId: auditorBId, type: "AUDIT_ASSIGNED" }),
    });
  });

  it("rejects assigning auditors to a closed cycle", async () => {
    mocks.auditCycleFindUnique.mockResolvedValueOnce({ id: cycleId, status: "CLOSED" });

    await expect(assignAuditors(cycleId, { auditorIds: [auditorId] })).rejects.toMatchObject({
      statusCode: 409,
      code: "AUDIT_CYCLE_CLOSED",
    });
  });
});

describe("activateAuditCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves department-scoped assets via active/overdue allocations and notifies assigned auditors", async () => {
    mocks.auditCycleFindUnique
      .mockResolvedValueOnce({
        id: cycleId,
        status: "DRAFT",
        name: "Engineering Audit",
        scopeDepartmentId: deptId,
        scopeLocation: null,
      })
      .mockResolvedValueOnce({
        id: cycleId,
        status: "ACTIVE",
        name: "Engineering Audit",
        scopeDepartment: { id: deptId, name: "Engineering", code: "ENG" },
        createdBy: { id: adminId, name: "Admin", email: "admin@x.com" },
        assignments: [{ auditorId, auditor: { id: auditorId, name: "Auditor A", email: "a@x.com" } }],
        records: [],
      });
    mocks.employeeFindMany.mockResolvedValue([{ id: employeeInDeptId }]);
    mocks.assetFindMany.mockResolvedValue([{ id: assetAId }, { id: assetBId }]);
    mocks.$transaction.mockImplementation(async (callback) =>
      callback({
        auditRecord: { createMany: mocks.auditRecordCreateMany },
        auditCycle: { update: mocks.auditCycleUpdate },
      }),
    );
    mocks.auditRecordCreateMany.mockResolvedValue({ count: 2 });
    mocks.auditCycleUpdate.mockResolvedValue({});
    mocks.auditAssignmentFindMany.mockResolvedValue([{ auditorId }]);
    mocks.notificationCreate.mockResolvedValue({ id: "n1" });

    const result = await activateAuditCycle(cycleId);

    expect(mocks.assetFindMany).toHaveBeenCalledWith({
      where: {
        AND: [
          {
            allocations: {
              some: { employeeId: { in: [employeeInDeptId] }, status: { in: ["ACTIVE", "OVERDUE"] } },
            },
          },
        ],
      },
      select: { id: true },
    });
    expect(mocks.auditRecordCreateMany).toHaveBeenCalledWith({
      data: [
        { auditCycleId: cycleId, assetId: assetAId, status: "PENDING" },
        { auditCycleId: cycleId, assetId: assetBId, status: "PENDING" },
      ],
      skipDuplicates: true,
    });
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ employeeId: auditorId, type: "AUDIT_ACTIVATED" }),
    });
    expect(result.cycle.status).toBe("ACTIVE");
  });

  it("rejects activating a cycle that is not in draft status", async () => {
    mocks.auditCycleFindUnique.mockResolvedValueOnce({ id: cycleId, status: "ACTIVE" });

    await expect(activateAuditCycle(cycleId)).rejects.toMatchObject({
      statusCode: 409,
      code: "AUDIT_CYCLE_INVALID_TRANSITION",
    });
  });
});

describe("recordAuditStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects recording when the cycle is not active", async () => {
    mocks.auditRecordFindUnique.mockResolvedValue({
      id: recordId,
      auditCycle: { status: "DRAFT", assignments: [] },
    });

    await expect(
      recordAuditStatus(recordId, { status: "VERIFIED" }, { employeeId: auditorId, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ statusCode: 409, code: "AUDIT_CYCLE_NOT_ACTIVE" });
  });

  it("rejects an unassigned non-manager auditor", async () => {
    mocks.auditRecordFindUnique.mockResolvedValue({
      id: recordId,
      auditCycle: { status: "ACTIVE", assignments: [{ auditorId: auditorBId }] },
    });

    await expect(
      recordAuditStatus(recordId, { status: "MISSING" }, { employeeId: auditorId, role: "EMPLOYEE" }),
    ).rejects.toMatchObject({ statusCode: 403, code: "FORBIDDEN" });
  });

  it("allows an asset manager to record results even when not assigned", async () => {
    mocks.auditRecordFindUnique.mockResolvedValue({
      id: recordId,
      auditCycle: { status: "ACTIVE", assignments: [] },
    });
    mocks.auditRecordUpdate.mockResolvedValue({ id: recordId, status: "DAMAGED" });

    await expect(
      recordAuditStatus(
        recordId,
        { status: "DAMAGED", notes: "Cracked screen" },
        { employeeId: adminId, role: "ASSET_MANAGER" },
      ),
    ).resolves.toMatchObject({ status: "DAMAGED" });
  });

  it("allows the assigned auditor to record results", async () => {
    mocks.auditRecordFindUnique.mockResolvedValue({
      id: recordId,
      auditCycle: { status: "ACTIVE", assignments: [{ auditorId }] },
    });
    mocks.auditRecordUpdate.mockResolvedValue({ id: recordId, status: "VERIFIED" });

    await expect(
      recordAuditStatus(recordId, { status: "VERIFIED" }, { employeeId: auditorId, role: "EMPLOYEE" }),
    ).resolves.toMatchObject({ status: "VERIFIED" });
  });
});

describe("closeAuditCycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("flips MISSING assets to LOST, raises a HIGH-priority request for DAMAGED assets, notifies auditors other than the closer, and blocks a second close", async () => {
    const activeCycle = {
      id: cycleId,
      name: "Engineering Audit",
      status: "ACTIVE",
      records: [
        {
          id: "r1",
          assetId: assetAId,
          status: "MISSING",
          notes: null,
          asset: { id: assetAId, assetTag: "AF-0001", name: "MacBook", status: "ALLOCATED" },
        },
        {
          id: "r2",
          assetId: assetBId,
          status: "DAMAGED",
          notes: "Cracked screen",
          asset: { id: assetBId, assetTag: "AF-0002", name: "Projector", status: "AVAILABLE" },
        },
        {
          id: "r3",
          assetId: assetCId,
          status: "VERIFIED",
          notes: null,
          asset: { id: assetCId, assetTag: "AF-0003", name: "Chair", status: "AVAILABLE" },
        },
        {
          id: "r4",
          assetId: assetDId,
          status: "PENDING",
          notes: null,
          asset: { id: assetDId, assetTag: "AF-0004", name: "Drill", status: "AVAILABLE" },
        },
      ],
      assignments: [{ auditorId }, { auditorId: adminId }],
    };
    mocks.auditCycleFindUnique.mockResolvedValueOnce(activeCycle);
    mocks.$transaction.mockImplementation(async (callback) =>
      callback({
        asset: { update: mocks.assetUpdate },
        maintenanceRequest: { create: mocks.maintenanceRequestCreate },
        auditCycle: { update: mocks.auditCycleUpdate },
      }),
    );
    mocks.assetUpdate.mockResolvedValue({});
    mocks.maintenanceRequestCreate.mockResolvedValue({ id: "mreq1" });
    mocks.auditCycleUpdate.mockResolvedValue({ id: cycleId, status: "CLOSED", closedAt: new Date() });
    mocks.notificationCreate.mockResolvedValue({ id: "n1" });

    const result = await closeAuditCycle(cycleId, { employeeId: adminId, role: "ADMIN" });

    expect(mocks.assetUpdate).toHaveBeenCalledWith({
      where: { id: assetAId },
      data: { status: "LOST" },
    });
    expect(mocks.maintenanceRequestCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        assetId: assetBId,
        raisedById: adminId,
        priority: "HIGH",
        status: "PENDING",
        description: expect.stringContaining("Cracked screen"),
      }),
    });
    expect(mocks.auditCycleUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: cycleId },
        data: expect.objectContaining({ status: "CLOSED" }),
      }),
    );

    // The closing admin is also assigned as an auditor on this cycle, but must not be notified
    // about their own action — only the other assigned auditor is a genuinely affected user.
    expect(mocks.notificationCreate).toHaveBeenCalledTimes(1);
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ employeeId: auditorId, type: "AUDIT_CLOSED" }),
    });

    expect(result.summary).toMatchObject({ total: 4, verified: 1, missing: 1, damaged: 1, pending: 1 });
    expect(result.missingAssets).toEqual([{ id: assetAId, assetTag: "AF-0001", name: "MacBook" }]);
    expect(result.damagedAssets).toEqual([
      { id: assetBId, assetTag: "AF-0002", name: "Projector", maintenanceRequestId: "mreq1" },
    ]);

    mocks.auditCycleFindUnique.mockResolvedValueOnce({
      id: cycleId,
      name: "Engineering Audit",
      status: "CLOSED",
      records: [],
      assignments: [],
    });

    await expect(closeAuditCycle(cycleId, { employeeId: adminId, role: "ADMIN" })).rejects.toMatchObject({
      statusCode: 409,
      code: "AUDIT_CYCLE_INVALID_TRANSITION",
    });
  });
});
