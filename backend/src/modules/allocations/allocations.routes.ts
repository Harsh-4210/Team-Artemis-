import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import {
  createAllocationController,
  listAllocationsController,
  listOverdueAllocationsController,
  returnAllocationController,
} from "./allocations.controller";

export const allocationsRouter = Router();

allocationsRouter.use(authenticateToken);
allocationsRouter.get("/", asyncHandler(listAllocationsController));
allocationsRouter.get(
  "/overdue",
  asyncHandler(listOverdueAllocationsController),
);
allocationsRouter.post("/", asyncHandler(createAllocationController));
allocationsRouter.post("/:id/return", asyncHandler(returnAllocationController));
