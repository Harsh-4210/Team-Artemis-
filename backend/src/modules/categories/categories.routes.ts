import { Router } from "express";

import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import {
  createCategoryController,
  deleteCategoryController,
  listCategoriesController,
  updateCategoryController,
} from "./categories.controller";

export const categoriesRouter = Router();

categoriesRouter.use(authenticateToken);
categoriesRouter.get("/", asyncHandler(listCategoriesController));
categoriesRouter.post(
  "/",
  requireRole("ADMIN"),
  asyncHandler(createCategoryController),
);
categoriesRouter.patch(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(updateCategoryController),
);
categoriesRouter.delete(
  "/:id",
  requireRole("ADMIN"),
  asyncHandler(deleteCategoryController),
);
