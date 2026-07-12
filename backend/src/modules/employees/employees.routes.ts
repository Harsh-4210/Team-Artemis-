import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  listEmployeesController,
  promoteEmployeeController,
  updateEmployeeStatusController,
} from "./employees.controller";

export const employeesRouter = Router();

employeesRouter.use(authenticateToken);
employeesRouter.get(
  "/",
  requireRole("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"),
  asyncHandler(listEmployeesController),
);
employeesRouter.patch(
  "/:id/promote",
  requireRole("ADMIN"),
  asyncHandler(promoteEmployeeController),
);
employeesRouter.patch(
  "/:id/status",
  requireRole("ADMIN"),
  asyncHandler(updateEmployeeStatusController),
);
