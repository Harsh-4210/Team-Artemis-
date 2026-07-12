import { TransferStatus } from "@prisma/client";
import { z } from "zod";

export const transferIdParamsSchema = z.object({
  id: z.string().uuid(),
});

export const transferStatusSchema = z.nativeEnum(TransferStatus);

export const createTransferSchema = z.object({
  assetId: z.string().uuid(),
  fromEmployeeId: z.string().uuid(),
  toEmployeeId: z.string().uuid(),
  reason: z
    .string()
    .trim()
    .min(5, "Add a short reason for the transfer.")
    .max(500),
});

export const transferDecisionSchema = z.object({
  notes: z.string().trim().max(500).optional(),
});

export const rejectTransferSchema = z.object({
  reason: z.string().trim().min(3, "Add a rejection reason.").max(500),
});

export const listTransfersQuerySchema = z.object({
  status: transferStatusSchema.optional(),
  assetId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
});

export type CreateTransferInput = z.infer<typeof createTransferSchema>;
export type TransferDecisionInput = z.infer<typeof transferDecisionSchema>;
export type RejectTransferInput = z.infer<typeof rejectTransferSchema>;
export type ListTransfersQuery = z.infer<typeof listTransfersQuerySchema>;
