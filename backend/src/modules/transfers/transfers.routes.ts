import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  approveTransferController,
  listTransfersController,
  rejectTransferController,
  requestTransferController,
} from "./transfers.controller";

export const transfersRouter = Router();

transfersRouter.use(authenticateToken);
transfersRouter.get("/", asyncHandler(listTransfersController));
transfersRouter.post("/", asyncHandler(requestTransferController));
transfersRouter.post(
  "/:id/approve",
  requireRole("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"),
  asyncHandler(approveTransferController),
);
transfersRouter.post(
  "/:id/reject",
  requireRole("ADMIN", "ASSET_MANAGER", "DEPARTMENT_HEAD"),
  asyncHandler(rejectTransferController),
);
