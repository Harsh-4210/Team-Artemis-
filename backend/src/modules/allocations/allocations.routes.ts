import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  createAllocationController,
  listAllocationsController,
  listOverdueAllocationsController,
  markOverdueAllocationsController,
  returnAllocationController,
} from "./allocations.controller";

export const allocationsRouter = Router();

allocationsRouter.use(authenticateToken);
allocationsRouter.get("/", asyncHandler(listAllocationsController));
allocationsRouter.get(
  "/overdue",
  asyncHandler(listOverdueAllocationsController),
);
allocationsRouter.post(
  "/mark-overdue",
  requireRole("ADMIN", "ASSET_MANAGER"),
  asyncHandler(markOverdueAllocationsController),
);
allocationsRouter.post("/", asyncHandler(createAllocationController));
allocationsRouter.post("/:id/return", asyncHandler(returnAllocationController));
