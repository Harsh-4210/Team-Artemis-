import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { asyncHandler } from "../../utils/async-handler";
import { authenticateToken } from "../../middleware/auth";

export const notificationsRouter = Router();
notificationsRouter.use(authenticateToken);
notificationsRouter.get("/", asyncHandler(async (request, response) => {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  const query = z.object({ unreadOnly: z.enum(["true", "false"]).optional() }).parse(request.query);
  const notifications = await prisma.notification.findMany({ where: { employeeId: request.auth.employeeId, isRead: query.unreadOnly === "true" ? false : undefined }, orderBy: { createdAt: "desc" }, take: 30 });
  const unreadCount = await prisma.notification.count({ where: { employeeId: request.auth.employeeId, isRead: false } });
  response.json({ data: { notifications, unreadCount } });
}));
notificationsRouter.patch("/read-all", asyncHandler(async (request, response) => {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  const result = await prisma.notification.updateMany({ where: { employeeId: request.auth.employeeId, isRead: false }, data: { isRead: true } });
  response.json({ data: { updated: result.count } });
}));
notificationsRouter.patch("/:id/read", asyncHandler(async (request, response) => {
  if (!request.auth) throw new AppError(401, "AUTHENTICATION_REQUIRED", "Authentication is required");
  const { id } = z.object({ id: z.string().uuid() }).parse(request.params);
  const item = await prisma.notification.findFirst({ where: { id, employeeId: request.auth.employeeId } });
  if (!item) throw new AppError(404, "NOTIFICATION_NOT_FOUND", "Notification not found");
  response.json({ data: await prisma.notification.update({ where: { id }, data: { isRead: true } }) });
}));
