import { Prisma, Role } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

export type ActivityInput = {
  employeeId: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Prisma.InputJsonValue;
};

export async function logActivity(input: ActivityInput) {
  return prisma.activityLog.create({ data: input });
}

export async function listActivityLogs(
  filters: { entityType?: string; entityId?: string; employeeId?: string; from?: Date; to?: Date },
  actor: { role: Role },
) {
  if (actor.role !== Role.ADMIN) throw new AppError(403, "FORBIDDEN", "Only administrators can view activity logs");
  return prisma.activityLog.findMany({
    where: {
      entityType: filters.entityType,
      entityId: filters.entityId,
      employeeId: filters.employeeId,
      createdAt: { gte: filters.from, lte: filters.to },
    },
    include: { employee: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: 250,
  });
}
