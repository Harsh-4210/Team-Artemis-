import { AssetCondition, AssetStatus } from "@prisma/client";
import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === "" ? undefined : value),
  z.string().trim().min(1).max(255).optional(),
);

export const assetIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const assetStatusSchema = z.nativeEnum(AssetStatus);
export const assetConditionSchema = z.nativeEnum(AssetCondition);

const assetBaseSchema = z.object({
  name: z.string().trim().min(2, "Enter an asset name.").max(140),
  categoryId: z.string().uuid("Choose a valid category."),
  serialNumber: optionalText,
  acquisitionDate: z.coerce.date(),
  acquisitionCost: z.coerce
    .number()
    .positive("Enter a positive acquisition cost."),
  condition: assetConditionSchema.optional(),
  location: z.string().trim().min(2, "Enter a location.").max(160),
  photoUrl: optionalText,
  isBookable: z.coerce.boolean().optional(),
  customData: z.record(z.string(), z.unknown()).optional(),
  status: assetStatusSchema.optional(),
});

export const createAssetSchema = assetBaseSchema;
export const updateAssetSchema = assetBaseSchema.partial();

export const listAssetsQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: assetStatusSchema.optional(),
  categoryId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  location: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateAssetInput = z.infer<typeof createAssetSchema>;
export type UpdateAssetInput = z.infer<typeof updateAssetSchema>;
export type ListAssetsQuery = z.infer<typeof listAssetsQuerySchema>;
