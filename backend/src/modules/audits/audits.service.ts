import {
  AllocationStatus,
  AssetStatus,
  AuditCycleStatus,
  AuditRecordStatus,
  EmployeeStatus,
  MaintenancePriority,
  MaintenanceStatus,
  Prisma,
  type Role,
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { notify } from "../notifications/notify";
import { logActivity } from "../activity-logs/activity-logs.service";
import type {
  AssignAuditorsInput,
  CreateAuditCycleInput,
  ListAuditCyclesQuery,
  RecordAuditStatusInput,
} from "./audits.schema";

// Asset managers and admins can act on any audit cycle regardless of assignment, matching the
// "Perform audit: ✔ always" column in the blueprint's RBAC matrix. Department heads and employees
// can only act when they hold an AuditAssignment for that specific cycle.
const MANAGER_ROLES: Role[] = ["ADMIN", "ASSET_MANAGER"];

const auditCycleListInclude = {
  scopeDepartment: { select: { id: true, name: true, code: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  assignments: { include: { auditor: { select: { id: true, name: true, email: true } } } },
  _count: { select: { records: true } },
} satisfies Prisma.AuditCycleInclude;

const auditRecordInclude = {
  asset: {
    select: {
      id: true,
      assetTag: true,
      name: true,
      location: true,
      status: true,
      condition: true,
      category: { select: { id: true, name: true } },
    },
  },
  auditor: { select: { id: true, name: true, email: true } },
} satisfies Prisma.AuditRecordInclude;

async function loadCycleOrThrow(id: string) {
  const cycle = await prisma.auditCycle.findUnique({ where: { id } });
  if (!cycle) {
    throw new AppError(404, "AUDIT_CYCLE_NOT_FOUND", "Audit cycle not found");
  }
  return cycle;
}

async function fetchCycleDetail(id: string) {
  const cycle = await prisma.auditCycle.findUnique({
    where: { id },
    include: {
      scopeDepartment: { select: { id: true, name: true, code: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      assignments: { include: { auditor: { select: { id: true, name: true, email: true } } } },
      records: { include: auditRecordInclude, orderBy: { asset: { assetTag: "asc" } } },
    },
  });
  if (!cycle) {
    throw new AppError(404, "AUDIT_CYCLE_NOT_FOUND", "Audit cycle not found");
  }

  const summary = {
    total: cycle.records.length,
    verified: cycle.records.filter((record) => record.status === AuditRecordStatus.VERIFIED).length,
    missing: cycle.records.filter((record) => record.status === AuditRecordStatus.MISSING).length,
    damaged: cycle.records.filter((record) => record.status === AuditRecordStatus.DAMAGED).length,
    pending: cycle.records.filter((record) => record.status === AuditRecordStatus.PENDING).length,
  };

  return { cycle, summary };
}

function assertCanView(
  cycle: { assignments: Array<{ auditorId: string }> },
  actor: { employeeId: string; role: Role },
) {
  if (MANAGER_ROLES.includes(actor.role)) return;
  const isAssigned = cycle.assignments.some((assignment) => assignment.auditorId === actor.employeeId);
  if (!isAssigned) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only assigned auditors or asset managers can view this audit cycle",
    );
  }
}

async function assertDepartmentExists(id: string) {
  const department = await prisma.department.findUnique({ where: { id }, select: { id: true } });
  if (!department) {
    throw new AppError(400, "INVALID_SCOPE_DEPARTMENT", "The selected scope department does not exist");
  }
}

async function assertAuditorsValid(auditorIds: string[]) {
  const uniqueIds = Array.from(new Set(auditorIds));
  const employees = await prisma.employee.findMany({
    where: { id: { in: uniqueIds } },
    select: { id: true, status: true },
  });

  const foundIds = new Set(employees.map((employee) => employee.id));
  const missing = uniqueIds.filter((id) => !foundIds.has(id));
  if (missing.length > 0) {
    throw new AppError(400, "INVALID_AUDITOR", "One or more auditor IDs do not exist", { missing });
  }

  const inactive = employees.filter((employee) => employee.status !== EmployeeStatus.ACTIVE).map((e) => e.id);
  if (inactive.length > 0) {
    throw new AppError(
      400,
      "INVALID_AUDITOR",
      "One or more selected auditors are not active employees",
      { inactive },
    );
  }

  return uniqueIds;
}

// Scope interpretation (documented per the approved Phase 1 plan):
// - Department scope: assets with an ACTIVE or OVERDUE allocation to an employee in that exact
//   department (not recursive into child departments). Assets have no direct department column,
//   so custody via allocation is the only reliable department signal in the current schema.
// - Location scope: exact match on Asset.location.
// - Both scopes present: intersection of the two conditions above.
// - Neither scope: organization-wide, excluding LOST, RETIRED, and DISPOSED assets.
async function resolveInScopeAssetIds(cycle: {
  scopeDepartmentId: string | null;
  scopeLocation: string | null;
}) {
  const conditions: Prisma.AssetWhereInput[] = [];

  if (cycle.scopeDepartmentId) {
    const departmentEmployees = await prisma.employee.findMany({
      where: { departmentId: cycle.scopeDepartmentId },
      select: { id: true },
    });
    const employeeIds = departmentEmployees.map((employee) => employee.id);
    conditions.push({
      allocations: {
        some: {
          employeeId: { in: employeeIds },
          status: { in: [AllocationStatus.ACTIVE, AllocationStatus.OVERDUE] },
        },
      },
    });
  }

  if (cycle.scopeLocation) {
    conditions.push({ location: cycle.scopeLocation });
  }

  const where: Prisma.AssetWhereInput =
    conditions.length > 0
      ? { AND: conditions }
      : { status: { notIn: [AssetStatus.LOST, AssetStatus.RETIRED, AssetStatus.DISPOSED] } };

  const assets = await prisma.asset.findMany({ where, select: { id: true } });
  return assets.map((asset) => asset.id);
}

export async function listAuditCycles(
  query: ListAuditCyclesQuery,
  actor: { employeeId: string; role: Role },
) {
  const canSeeAll = MANAGER_ROLES.includes(actor.role);
  const where: Prisma.AuditCycleWhereInput = {
    status: query.status,
    ...(canSeeAll ? {} : { assignments: { some: { auditorId: actor.employeeId } } }),
  };

  return prisma.auditCycle.findMany({
    where,
    include: auditCycleListInclude,
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
}

export async function createAuditCycle(input: CreateAuditCycleInput, actor: { employeeId: string }) {
  if (input.scopeDepartmentId) {
    await assertDepartmentExists(input.scopeDepartmentId);
  }

  return prisma.auditCycle.create({
    data: {
      name: input.name,
      scopeDepartmentId: input.scopeDepartmentId,
      scopeLocation: input.scopeLocation,
      startDate: input.startDate,
      endDate: input.endDate,
      status: AuditCycleStatus.DRAFT,
      createdById: actor.employeeId,
    },
    include: auditCycleListInclude,
  });
}

export async function getAuditCycleDetail(id: string, actor: { employeeId: string; role: Role }) {
  const detail = await fetchCycleDetail(id);
  assertCanView(detail.cycle, actor);
  return detail;
}

export async function assignAuditors(id: string, input: AssignAuditorsInput) {
  const cycle = await loadCycleOrThrow(id);
  if (cycle.status === AuditCycleStatus.CLOSED) {
    throw new AppError(409, "AUDIT_CYCLE_CLOSED", "Auditors cannot be assigned to a closed audit cycle");
  }

  const uniqueIds = await assertAuditorsValid(input.auditorIds);

  const existing = await prisma.auditAssignment.findMany({
    where: { auditCycleId: id, auditorId: { in: uniqueIds } },
    select: { auditorId: true },
  });
  const existingIds = new Set(existing.map((assignment) => assignment.auditorId));
  const newIds = uniqueIds.filter((auditorId) => !existingIds.has(auditorId));

  if (newIds.length > 0) {
    await prisma.auditAssignment.createMany({
      data: newIds.map((auditorId) => ({ auditCycleId: id, auditorId })),
      skipDuplicates: true,
    });

    await Promise.all(
      newIds.map((auditorId) =>
        notify({
          employeeId: auditorId,
          type: "AUDIT_ASSIGNED",
          title: "You were assigned to an audit cycle",
          message: `You have been assigned as an auditor for "${cycle.name}".`,
          relatedEntityType: "AuditCycle",
          relatedEntityId: cycle.id,
        }),
      ),
    );
  }

  return fetchCycleDetail(id);
}

export async function activateAuditCycle(id: string) {
  const cycle = await loadCycleOrThrow(id);
  if (cycle.status !== AuditCycleStatus.DRAFT) {
    throw new AppError(
      409,
      "AUDIT_CYCLE_INVALID_TRANSITION",
      `Only draft cycles can be activated (current: ${cycle.status.toLowerCase()})`,
    );
  }

  const assetIds = await resolveInScopeAssetIds(cycle);

  await prisma.$transaction(async (tx) => {
    if (assetIds.length > 0) {
      await tx.auditRecord.createMany({
        data: assetIds.map((assetId) => ({
          auditCycleId: id,
          assetId,
          status: AuditRecordStatus.PENDING,
        })),
        skipDuplicates: true,
      });
    }
    await tx.auditCycle.update({ where: { id }, data: { status: AuditCycleStatus.ACTIVE } });
  });

  const assignments = await prisma.auditAssignment.findMany({
    where: { auditCycleId: id },
    select: { auditorId: true },
  });
  await Promise.all(
    assignments.map((assignment) =>
      notify({
        employeeId: assignment.auditorId,
        type: "AUDIT_ACTIVATED",
        title: "Audit cycle is now active",
        message: `"${cycle.name}" is active with ${assetIds.length} asset${assetIds.length === 1 ? "" : "s"} to verify.`,
        relatedEntityType: "AuditCycle",
        relatedEntityId: cycle.id,
      }),
    ),
  );

  return fetchCycleDetail(id);
}

export async function recordAuditStatus(
  recordId: string,
  input: RecordAuditStatusInput,
  actor: { employeeId: string; role: Role },
) {
  const record = await prisma.auditRecord.findUnique({
    where: { id: recordId },
    include: { auditCycle: { include: { assignments: true } } },
  });
  if (!record) {
    throw new AppError(404, "AUDIT_RECORD_NOT_FOUND", "Audit record not found");
  }

  if (record.auditCycle.status !== AuditCycleStatus.ACTIVE) {
    throw new AppError(
      409,
      "AUDIT_CYCLE_NOT_ACTIVE",
      `Records can only be updated while the cycle is active (current: ${record.auditCycle.status.toLowerCase()})`,
    );
  }

  const isManager = MANAGER_ROLES.includes(actor.role);
  const isAssignedAuditor = record.auditCycle.assignments.some(
    (assignment) => assignment.auditorId === actor.employeeId,
  );
  if (!isManager && !isAssignedAuditor) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only assigned auditors or asset managers can record audit results",
    );
  }

  const updated = await prisma.auditRecord.update({
    where: { id: recordId },
    data: {
      status: input.status,
      notes: input.notes,
      auditorId: actor.employeeId,
      recordedAt: new Date(),
    },
    include: auditRecordInclude,
  });
  await logActivity({ employeeId: actor.employeeId, action: `AUDIT_RECORD_${input.status}`, entityType: "AUDIT_RECORD", entityId: updated.id, details: { auditCycleId: updated.auditCycleId, assetId: updated.assetId } });
  return updated;
}

export async function closeAuditCycle(id: string, actor: { employeeId: string; role: Role }) {
  const cycle = await prisma.auditCycle.findUnique({
    where: { id },
    include: {
      records: {
        include: { asset: { select: { id: true, assetTag: true, name: true, status: true } } },
      },
      assignments: true,
    },
  });
  if (!cycle) {
    throw new AppError(404, "AUDIT_CYCLE_NOT_FOUND", "Audit cycle not found");
  }
  if (cycle.status !== AuditCycleStatus.ACTIVE) {
    throw new AppError(
      409,
      "AUDIT_CYCLE_INVALID_TRANSITION",
      cycle.status === AuditCycleStatus.CLOSED
        ? "This audit cycle has already been closed"
        : `Only active cycles can be closed (current: ${cycle.status.toLowerCase()})`,
    );
  }

  const missingRecords = cycle.records.filter((record) => record.status === AuditRecordStatus.MISSING);
  const damagedRecords = cycle.records.filter((record) => record.status === AuditRecordStatus.DAMAGED);
  const verifiedCount = cycle.records.filter((record) => record.status === AuditRecordStatus.VERIFIED).length;
  const pendingCount = cycle.records.filter((record) => record.status === AuditRecordStatus.PENDING).length;

  const result = await prisma.$transaction(async (tx) => {
    for (const record of missingRecords) {
      await tx.asset.update({ where: { id: record.assetId }, data: { status: AssetStatus.LOST } });
    }

    const createdMaintenanceRequests: Array<{ assetId: string; maintenanceRequestId: string }> = [];
    for (const record of damagedRecords) {
      const maintenanceRequest = await tx.maintenanceRequest.create({
        data: {
          assetId: record.assetId,
          raisedById: actor.employeeId,
          description: `Audit cycle "${cycle.name}" flagged this asset as damaged.${
            record.notes ? ` Auditor notes: ${record.notes}` : ""
          }`,
          priority: MaintenancePriority.HIGH,
          status: MaintenanceStatus.PENDING,
        },
      });
      createdMaintenanceRequests.push({ assetId: record.assetId, maintenanceRequestId: maintenanceRequest.id });
    }

    const updatedCycle = await tx.auditCycle.update({
      where: { id },
      data: { status: AuditCycleStatus.CLOSED, closedAt: new Date() },
    });

    return { updatedCycle, createdMaintenanceRequests };
  });

  // Notify genuinely affected users only: assigned auditors did the verification work and should
  // know the outcome, but never notify the admin who just performed the close about their own
  // action. A Set naturally de-duplicates in case of any assignment overlap.
  const auditorIdsToNotify = new Set(cycle.assignments.map((assignment) => assignment.auditorId));
  auditorIdsToNotify.delete(actor.employeeId);
  const summaryMessage = `Audit cycle "${cycle.name}" closed: ${missingRecords.length} missing, ${damagedRecords.length} damaged, ${verifiedCount} verified.`;
  await Promise.all(
    Array.from(auditorIdsToNotify).map((employeeId) =>
      notify({
        employeeId,
        type: "AUDIT_CLOSED",
        title: "Audit cycle closed",
        message: summaryMessage,
        relatedEntityType: "AuditCycle",
        relatedEntityId: cycle.id,
      }),
    ),
  );
  await logActivity({ employeeId: actor.employeeId, action: "AUDIT_CYCLE_CLOSED", entityType: "AUDIT_CYCLE", entityId: cycle.id, details: { missing: missingRecords.length, damaged: damagedRecords.length } });

  const summary = {
    total: cycle.records.length,
    verified: verifiedCount,
    missing: missingRecords.length,
    damaged: damagedRecords.length,
    pending: pendingCount,
  };

  return {
    cycle: result.updatedCycle,
    summary,
    missingAssets: missingRecords.map((record) => ({
      id: record.asset.id,
      assetTag: record.asset.assetTag,
      name: record.asset.name,
    })),
    damagedAssets: damagedRecords.map((record) => {
      const created = result.createdMaintenanceRequests.find((entry) => entry.assetId === record.assetId);
      return {
        id: record.asset.id,
        assetTag: record.asset.assetTag,
        name: record.asset.name,
        maintenanceRequestId: created?.maintenanceRequestId ?? null,
      };
    }),
  };
}

export async function getAuditDiscrepancies(id: string, actor: { employeeId: string; role: Role }) {
  const detail = await fetchCycleDetail(id);
  assertCanView(detail.cycle, actor);

  const discrepancies = detail.cycle.records.filter(
    (record) => record.status === AuditRecordStatus.MISSING || record.status === AuditRecordStatus.DAMAGED,
  );

  return {
    cycleId: detail.cycle.id,
    cycleName: detail.cycle.name,
    cycleStatus: detail.cycle.status,
    summary: detail.summary,
    discrepancies,
  };
}
