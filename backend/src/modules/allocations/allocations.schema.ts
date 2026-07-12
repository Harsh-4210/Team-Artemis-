import { AssetCondition, AllocationStatus } from "@prisma/client";
import { z } from "zod";

export const allocationIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const allocationStatusSchema = z.nativeEnum(AllocationStatus);
export const assetConditionSchema = z.nativeEnum(AssetCondition);

export const createAllocationSchema = z.object({
  assetId: z.string().uuid(),
  employeeId: z.string().uuid(),
  expectedReturnDate: z.coerce.date().optional(),
  notes: z.string().trim().max(500).optional(),
});

export const returnAllocationSchema = z.object({
  conditionOnReturn: assetConditionSchema.optional(),
  notes: z.string().trim().max(500).optional(),
});

export const listAllocationsQuerySchema = z.object({
  status: allocationStatusSchema.optional(),
  scope: z.enum(["mine", "all"]).optional(),
  employeeId: z.string().uuid().optional(),
  assetId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateAllocationInput = z.infer<typeof createAllocationSchema>;
export type ReturnAllocationInput = z.infer<typeof returnAllocationSchema>;
export type ListAllocationsQuery = z.infer<typeof listAllocationsQuerySchema>;
