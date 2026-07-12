import type { Request, Response } from "express";

import { AppError } from "../../utils/app-error";
import {
  assignAuditorsSchema,
  auditCycleIdParamsSchema,
  auditRecordIdParamsSchema,
  createAuditCycleSchema,
  listAuditCyclesQuerySchema,
  recordAuditStatusSchema,
} from "./audits.schema";
import {
  activateAuditCycle,
  assignAuditors,
  closeAuditCycle,
  createAuditCycle,
  getAuditCycleDetail,
  getAuditDiscrepancies,
  listAuditCycles,
  recordAuditStatus,
} from "./audits.service";

function requireAuth(request: Request) {
  if (!request.auth) {
    throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  }
  return request.auth;
}

export async function listAuditCyclesController(request: Request, response: Response) {
  const auth = requireAuth(request);
  const query = listAuditCyclesQuerySchema.parse(request.query);
  const data = await listAuditCycles(query, { employeeId: auth.employeeId, role: auth.role });
  response.json({ data });
}

export async function createAuditCycleController(request: Request, response: Response) {
  const auth = requireAuth(request);
  const input = createAuditCycleSchema.parse(request.body);
  const data = await createAuditCycle(input, { employeeId: auth.employeeId });
  response.status(201).json({ data });
}

export async function getAuditCycleController(request: Request, response: Response) {
  const auth = requireAuth(request);
  const { id } = auditCycleIdParamsSchema.parse(request.params);
  const data = await getAuditCycleDetail(id, { employeeId: auth.employeeId, role: auth.role });
  response.json({ data });
}

export async function assignAuditorsController(request: Request, response: Response) {
  requireAuth(request);
  const { id } = auditCycleIdParamsSchema.parse(request.params);
  const input = assignAuditorsSchema.parse(request.body);
  const data = await assignAuditors(id, input);
  response.json({ data });
}

export async function activateAuditCycleController(request: Request, response: Response) {
  requireAuth(request);
  const { id } = auditCycleIdParamsSchema.parse(request.params);
  const data = await activateAuditCycle(id);
  response.json({ data });
}

export async function closeAuditCycleController(request: Request, response: Response) {
  const auth = requireAuth(request);
  const { id } = auditCycleIdParamsSchema.parse(request.params);
  const data = await closeAuditCycle(id, { employeeId: auth.employeeId, role: auth.role });
  response.json({ data });
}

export async function getAuditDiscrepanciesController(request: Request, response: Response) {
  const auth = requireAuth(request);
  const { id } = auditCycleIdParamsSchema.parse(request.params);
  const data = await getAuditDiscrepancies(id, { employeeId: auth.employeeId, role: auth.role });
  response.json({ data });
}

export async function recordAuditStatusController(request: Request, response: Response) {
  const auth = requireAuth(request);
  const { id } = auditRecordIdParamsSchema.parse(request.params);
  const input = recordAuditStatusSchema.parse(request.body);
  const data = await recordAuditStatus(id, input, { employeeId: auth.employeeId, role: auth.role });
  response.json({ data });
}
