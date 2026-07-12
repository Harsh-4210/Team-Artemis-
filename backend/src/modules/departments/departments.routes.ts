import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  createDepartmentController,
  deleteDepartmentController,
  listDepartmentsController,
  updateDepartmentController,
} from "./departments.controller";

export const departmentsRouter = Router();

departmentsRouter.use(authenticateToken);
departmentsRouter.get("/", asyncHandler(listDepartmentsController));
departmentsRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(createDepartmentController),
);
departmentsRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(updateDepartmentController),
);
departmentsRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(deleteDepartmentController),
);
