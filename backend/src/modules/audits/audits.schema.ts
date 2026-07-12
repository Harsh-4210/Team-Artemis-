import { z } from "zod";

export const auditCycleIdParamsSchema = z.object({ id: z.string().uuid() }).strict();
export const auditRecordIdParamsSchema = z.object({ id: z.string().uuid() }).strict();

export const createAuditCycleSchema = z
  .object({
    name: z.string().trim().min(3).max(200),
    scopeDepartmentId: z.string().uuid().optional(),
    scopeLocation: z.string().trim().min(1).max(200).optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .strict()
  .refine((data) => data.endDate.getTime() > data.startDate.getTime(), {
    message: "End date must be after start date",
    path: ["endDate"],
  });

export const assignAuditorsSchema = z
  .object({
    auditorIds: z.array(z.string().uuid()).min(1).max(50),
  })
  .strict();

export const recordAuditStatusSchema = z
  .object({
    status: z.enum(["VERIFIED", "MISSING", "DAMAGED"]),
    notes: z.string().trim().max(1000).optional(),
  })
  .strict();

export const listAuditCyclesQuerySchema = z
  .object({
    status: z.enum(["DRAFT", "ACTIVE", "CLOSED"]).optional(),
  })
  .strict();

export type CreateAuditCycleInput = z.infer<typeof createAuditCycleSchema>;
export type AssignAuditorsInput = z.infer<typeof assignAuditorsSchema>;
export type RecordAuditStatusInput = z.infer<typeof recordAuditStatusSchema>;
export type ListAuditCyclesQuery = z.infer<typeof listAuditCyclesQuerySchema>;
