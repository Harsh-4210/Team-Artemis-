import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  createAssetController,
  deleteAssetController,
  getAssetController,
  listAssetsController,
  updateAssetController,
} from "./assets.controller";

export const assetsRouter = Router();

assetsRouter.use(authenticateToken);
assetsRouter.get("/", asyncHandler(listAssetsController));
assetsRouter.get("/:id", asyncHandler(getAssetController));
assetsRouter.post(
  "/",
  requireRole("ADMIN", "ASSET_MANAGER"),
  asyncHandler(createAssetController),
);
assetsRouter.patch(
  "/:id",
  requireRole("ADMIN", "ASSET_MANAGER"),
  asyncHandler(updateAssetController),
);
assetsRouter.delete(
  "/:id",
  requireRole("ADMIN", "ASSET_MANAGER"),
  asyncHandler(deleteAssetController),
);
