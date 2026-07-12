import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  approveTransferController,
  rejectTransferController,
  requestTransferController,
} from "./transfers.controller";

export const transfersRouter = Router();

transfersRouter.use(authenticateToken);
transfersRouter.post("/", asyncHandler(requestTransferController));
transfersRouter.post(
  "/:id/approve",
  requireRole("ADMIN", "ASSET_MANAGER"),
  asyncHandler(approveTransferController),
);
transfersRouter.post(
  "/:id/reject",
  requireRole("ADMIN", "ASSET_MANAGER"),
  asyncHandler(rejectTransferController),
);
