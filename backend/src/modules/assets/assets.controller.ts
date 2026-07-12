import type { Request, Response } from "express";

import { AppError } from "../../utils/app-error";
import {
  assetIdParamsSchema,
  createAssetSchema,
  listAssetsQuerySchema,
  updateAssetSchema,
} from "./assets.schema";
import {
  createAsset,
  deleteAsset,
  getAssetById,
  listAssets,
  updateAsset,
} from "./assets.service";

function requireAuth(request: Request) {
  if (!request.auth) {
    throw new AppError(
      401,
      "AUTHENTICATION_REQUIRED",
      "Authentication is required",
    );
  }
  return request.auth;
}

export async function listAssetsController(
  request: Request,
  response: Response,
) {
  requireAuth(request);
  const query = listAssetsQuerySchema.parse(request.query);
  response.json({ data: await listAssets(query) });
}

export async function getAssetController(request: Request, response: Response) {
  requireAuth(request);
  const { id } = assetIdParamsSchema.parse(request.params);
  response.json({ data: await getAssetById(id) });
}

export async function createAssetController(
  request: Request,
  response: Response,
) {
  requireAuth(request);
  const input = createAssetSchema.parse(request.body);
  response.status(201).json({ data: await createAsset(input) });
}

export async function updateAssetController(
  request: Request,
  response: Response,
) {
  requireAuth(request);
  const { id } = assetIdParamsSchema.parse(request.params);
  const input = updateAssetSchema.parse(request.body);
  response.json({ data: await updateAsset(id, input) });
}

export async function deleteAssetController(
  request: Request,
  response: Response,
) {
  requireAuth(request);
  const { id } = assetIdParamsSchema.parse(request.params);
  await deleteAsset(id);
  response.status(204).send();
}
