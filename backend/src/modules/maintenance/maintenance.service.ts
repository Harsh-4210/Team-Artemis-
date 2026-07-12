import {
  AllocationStatus,
  AssetStatus,
  EmployeeStatus,
  MaintenancePriority,
  MaintenanceStatus,
  Prisma,
  Role,
} from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logActivity } from "../activity-logs/activity-logs.service";
import { notify } from "../notifications/notify";
import type {
  ApproveMaintenanceRequestInput,
  AssignTechnicianInput,
  CreateMaintenanceRequestInput,
  ListMaintenanceQuery,
  RejectMaintenanceRequestInput,
  ResolveMaintenanceRequestInput,
} from "./maintenance.schema";

const maintenanceInclude = {
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
  raisedBy: {
    select: {
      id: true,
      name: true,
      email: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
  assignedTechnician: {
    select: { id: true, name: true, email: true },
  },
  approvedBy: {
    select: { id: true, name: true, email: true, role: true },
  },
} satisfies Prisma.MaintenanceRequestInclude;

const MANAGER_ROLES: Role[] = [Role.ADMIN, Role.ASSET_MANAGER];

function assertIsManager(actor: { role: Role }) {
  if (!MANAGER_ROLES.includes(actor.role)) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only asset managers or administrators can perform this action",
    );
  }
}

async function assertActiveEmployee(id: string, code: string, message: string) {
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, status: true },
  });
  if (!employee || employee.status !== EmployeeStatus.ACTIVE) {
    throw new AppError(400, code, message);
  }
}

async function loadRequestOrThrow(id: string) {
  const request = await prisma.maintenanceRequest.findUnique({ where: { id } });
  if (!request) {
    throw new AppError(404, "MAINTENANCE_REQUEST_NOT_FOUND", "Maintenance request not found");
  }
  return request;
}

// When a maintenance request is resolved, the asset should go back to whatever state it was
// really in: allocated (if a holder still exists) or available. This preserves P2's allocation
// history while keeping the physical status honest.
async function restorePostMaintenanceStatus(assetId: string) {
  const allocation = await prisma.allocation.findFirst({
    where: { assetId, status: AllocationStatus.ACTIVE },
    select: { id: true },
  });
  return allocation ? AssetStatus.ALLOCATED : AssetStatus.AVAILABLE;
}

export async function listMaintenanceRequests(
  query: ListMaintenanceQuery,
  actor: { employeeId: string; role: Role },
) {
  const restrictToSelf =
    query.scope === "mine" || (query.scope !== "all" && !MANAGER_ROLES.includes(actor.role));

  const where: Prisma.MaintenanceRequestWhereInput = {
    status: query.status,
    priority: query.priority,
    assetId: query.assetId,
  };

  if (restrictToSelf) {
    where.OR = [
      { raisedById: actor.employeeId },
      { assignedTechnicianId: actor.employeeId },
    ];
  } else if (query.raisedById) {
    where.raisedById = query.raisedById;
  }

  return prisma.maintenanceRequest.findMany({
    where,
    include: maintenanceInclude,
    orderBy: [{ status: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
  });
}

export async function createMaintenanceRequest(
  input: CreateMaintenanceRequestInput,
  actor: { employeeId: string; role: Role },
) {
  const asset = await prisma.asset.findUnique({
    where: { id: input.assetId },
    select: { id: true, status: true, name: true },
  });
  if (!asset) {
    throw new AppError(404, "ASSET_NOT_FOUND", "The requested asset does not exist");
  }
  if (
    asset.status === AssetStatus.RETIRED ||
    asset.status === AssetStatus.DISPOSED ||
    asset.status === AssetStatus.LOST
  ) {
    throw new AppError(
      400,
      "ASSET_UNAVAILABLE",
      `${asset.name} cannot receive maintenance requests because it is ${asset.status.toLowerCase()}`,
    );
  }

  const openRequest = await prisma.maintenanceRequest.findFirst({
    where: {
      assetId: input.assetId,
      status: {
        in: [
          MaintenanceStatus.PENDING,
          MaintenanceStatus.APPROVED,
          MaintenanceStatus.TECHNICIAN_ASSIGNED,
          MaintenanceStatus.IN_PROGRESS,
        ],
      },
    },
    select: { id: true, status: true },
  });
  if (openRequest) {
    throw new AppError(
      409,
      "MAINTENANCE_ALREADY_OPEN",
      "This asset already has an open maintenance request",
      { openRequestId: openRequest.id, status: openRequest.status },
    );
  }

  const created = await prisma.maintenanceRequest.create({
    data: {
      assetId: input.assetId,
      raisedById: actor.employeeId,
      description: input.description,
      priority: input.priority ?? MaintenancePriority.MEDIUM,
      photoUrl: input.photoUrl,
      status: MaintenanceStatus.PENDING,
    },
    include: maintenanceInclude,
  });
  await logActivity({ employeeId: actor.employeeId, action: "MAINTENANCE_REQUEST_CREATED", entityType: "MAINTENANCE", entityId: created.id, details: { assetId: created.assetId } });
  return created;
}

export async function approveMaintenanceRequest(
  id: string,
  input: ApproveMaintenanceRequestInput,
  actor: { employeeId: string; role: Role },
) {
  assertIsManager(actor);
  const request = await loadRequestOrThrow(id);

  if (request.status !== MaintenanceStatus.PENDING) {
    throw new AppError(
      409,
      "MAINTENANCE_INVALID_TRANSITION",
      `Only pending requests can be approved (current: ${request.status.toLowerCase()})`,
    );
  }

  if (input.assignedTechnicianId) {
    await assertActiveEmployee(
      input.assignedTechnicianId,
      "INVALID_TECHNICIAN",
      "The selected technician is not an active employee",
    );
  }

  const updated = await prisma.$transaction(async (tx) => {
    const nextStatus = input.assignedTechnicianId
      ? MaintenanceStatus.TECHNICIAN_ASSIGNED
      : MaintenanceStatus.APPROVED;

    const updated = await tx.maintenanceRequest.update({
      where: { id },
      data: {
        status: nextStatus,
        approvedById: actor.employeeId,
        assignedTechnicianId: input.assignedTechnicianId ?? null,
        resolutionNotes: input.notes ?? null,
      },
      include: maintenanceInclude,
    });

    await tx.asset.update({
      where: { id: request.assetId },
      data: { status: AssetStatus.UNDER_MAINTENANCE },
    });

    return updated;
  });
  await Promise.all([
    notify({ employeeId: updated.raisedById, type: "MAINTENANCE_APPROVED", title: "Maintenance request approved", message: `${updated.asset.name} is now under maintenance.`, relatedEntityType: "MAINTENANCE", relatedEntityId: updated.id }),
    logActivity({ employeeId: actor.employeeId, action: "MAINTENANCE_APPROVED", entityType: "MAINTENANCE", entityId: updated.id, details: { assetId: updated.assetId } }),
  ]);
  return updated;
}

export async function rejectMaintenanceRequest(
  id: string,
  input: RejectMaintenanceRequestInput,
  actor: { employeeId: string; role: Role },
) {
  assertIsManager(actor);
  const request = await loadRequestOrThrow(id);

  if (request.status !== MaintenanceStatus.PENDING) {
    throw new AppError(
      409,
      "MAINTENANCE_INVALID_TRANSITION",
      `Only pending requests can be rejected (current: ${request.status.toLowerCase()})`,
    );
  }

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      status: MaintenanceStatus.REJECTED,
      approvedById: actor.employeeId,
      resolutionNotes: input.reason,
    },
    include: maintenanceInclude,
  });
  await Promise.all([
    notify({ employeeId: updated.raisedById, type: "MAINTENANCE_REJECTED", title: "Maintenance request rejected", message: `Your request for ${updated.asset.name} was rejected.`, relatedEntityType: "MAINTENANCE", relatedEntityId: updated.id }),
    logActivity({ employeeId: actor.employeeId, action: "MAINTENANCE_REJECTED", entityType: "MAINTENANCE", entityId: updated.id }),
  ]);
  return updated;
}

export async function assignTechnician(
  id: string,
  input: AssignTechnicianInput,
  actor: { employeeId: string; role: Role },
) {
  assertIsManager(actor);
  const request = await loadRequestOrThrow(id);

  if (
    request.status !== MaintenanceStatus.APPROVED &&
    request.status !== MaintenanceStatus.TECHNICIAN_ASSIGNED
  ) {
    throw new AppError(
      409,
      "MAINTENANCE_INVALID_TRANSITION",
      `A technician can only be assigned after approval (current: ${request.status.toLowerCase()})`,
    );
  }

  await assertActiveEmployee(
    input.assignedTechnicianId,
    "INVALID_TECHNICIAN",
    "The selected technician is not an active employee",
  );

  return prisma.maintenanceRequest.update({
    where: { id },
    data: {
      assignedTechnicianId: input.assignedTechnicianId,
      status: MaintenanceStatus.TECHNICIAN_ASSIGNED,
    },
    include: maintenanceInclude,
  });
}

export async function startMaintenanceWork(id: string, actor: { employeeId: string; role: Role }) {
  const request = await loadRequestOrThrow(id);

  const isManager = MANAGER_ROLES.includes(actor.role);
  const isAssignedTechnician = request.assignedTechnicianId === actor.employeeId;
  if (!isManager && !isAssignedTechnician) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only the assigned technician or an asset manager can start this work",
    );
  }

  if (
    request.status !== MaintenanceStatus.APPROVED &&
    request.status !== MaintenanceStatus.TECHNICIAN_ASSIGNED
  ) {
    throw new AppError(
      409,
      "MAINTENANCE_INVALID_TRANSITION",
      `Work cannot start from status ${request.status.toLowerCase()}`,
    );
  }

  return prisma.maintenanceRequest.update({
    where: { id },
    data: { status: MaintenanceStatus.IN_PROGRESS },
    include: maintenanceInclude,
  });
}

export async function resolveMaintenanceRequest(
  id: string,
  input: ResolveMaintenanceRequestInput,
  actor: { employeeId: string; role: Role },
) {
  const request = await loadRequestOrThrow(id);

  const isManager = MANAGER_ROLES.includes(actor.role);
  const isAssignedTechnician = request.assignedTechnicianId === actor.employeeId;
  if (!isManager && !isAssignedTechnician) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "Only the assigned technician or an asset manager can resolve this request",
    );
  }

  if (
    request.status !== MaintenanceStatus.APPROVED &&
    request.status !== MaintenanceStatus.TECHNICIAN_ASSIGNED &&
    request.status !== MaintenanceStatus.IN_PROGRESS
  ) {
    throw new AppError(
      409,
      "MAINTENANCE_INVALID_TRANSITION",
      `Resolved status can only follow active work (current: ${request.status.toLowerCase()})`,
    );
  }

  const restoredStatus = await restorePostMaintenanceStatus(request.assetId);

  const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.maintenanceRequest.update({
      where: { id },
      data: {
        status: MaintenanceStatus.RESOLVED,
        resolvedAt: new Date(),
        resolutionNotes: input.resolutionNotes,
      },
      include: maintenanceInclude,
    });

    await tx.asset.update({
      where: { id: request.assetId },
      data: { status: restoredStatus },
    });

    return updated;
  });
  await Promise.all([
    notify({ employeeId: updated.raisedById, type: "MAINTENANCE_RESOLVED", title: "Maintenance resolved", message: `${updated.asset.name} is available again.`, relatedEntityType: "MAINTENANCE", relatedEntityId: updated.id }),
    logActivity({ employeeId: actor.employeeId, action: "MAINTENANCE_RESOLVED", entityType: "MAINTENANCE", entityId: updated.id }),
  ]);
  return updated;
}
