import { Router } from "express";
import { z } from "zod";
import { authenticateToken } from "../../middleware/auth";
import { requireRole } from "../../middleware/rbac";
import { asyncHandler } from "../../utils/async-handler";
import { listActivityLogs } from "./activity-logs.service";

export const activityLogsRouter = Router();
activityLogsRouter.use(authenticateToken, requireRole("ADMIN"));
activityLogsRouter.get("/", asyncHandler(async (request, response) => {
  const query = z.object({ entityType: z.string().trim().max(100).optional(), entityId: z.string().uuid().optional(), employeeId: z.string().uuid().optional(), from: z.coerce.date().optional(), to: z.coerce.date().optional() }).parse(request.query);
  if (!request.auth) throw new Error("Authentication is required");
  response.json({ data: await listActivityLogs(query, { role: request.auth.role }) });
}));
