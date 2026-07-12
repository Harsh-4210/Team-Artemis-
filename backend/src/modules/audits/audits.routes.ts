import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  activateAuditCycleController,
  assignAuditorsController,
  closeAuditCycleController,
  createAuditCycleController,
  getAuditCycleController,
  getAuditDiscrepanciesController,
  listAuditCyclesController,
  recordAuditStatusController,
} from "./audits.controller";

// This module owns two top-level resources per the blueprint's contract
// (/audit-cycles/* and /audit-records/:id). Each gets its own router mounted at its own prefix in
// app.ts, matching the single-resource-prefix convention every other module uses — mounting a
// single router at the bare "/api/v1" root would swallow all unrelated API traffic behind this
// module's auth middleware.
export const auditCyclesRouter = Router();
export const auditRecordsRouter = Router();

auditCyclesRouter.use(authenticateToken);

// Cycle management (create/assign/activate/close) is Admin-only, matching the blueprint's RBAC
// matrix row "Create audit cycles". Listing, detail, and discrepancies use mixed access resolved
// inside the service (asset managers always; others only when assigned as an auditor).
auditCyclesRouter.get("/", asyncHandler(listAuditCyclesController));
auditCyclesRouter.post("/", requireRole("ADMIN"), asyncHandler(createAuditCycleController));
auditCyclesRouter.get("/:id", asyncHandler(getAuditCycleController));
auditCyclesRouter.post("/:id/assign", requireRole("ADMIN"), asyncHandler(assignAuditorsController));
auditCyclesRouter.post("/:id/activate", requireRole("ADMIN"), asyncHandler(activateAuditCycleController));
auditCyclesRouter.post("/:id/close", requireRole("ADMIN"), asyncHandler(closeAuditCycleController));
auditCyclesRouter.get("/:id/discrepancies", asyncHandler(getAuditDiscrepanciesController));

auditRecordsRouter.use(authenticateToken);
auditRecordsRouter.patch("/:id", asyncHandler(recordAuditStatusController));
