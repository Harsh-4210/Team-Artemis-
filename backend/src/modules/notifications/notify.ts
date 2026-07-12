import { prisma } from "../../config/prisma";

export type NotifyInput = {
  employeeId: string;
  type: string;
  title: string;
  message: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
};

/** Persist an in-app notification for an employee (P4 notify helper). */
export async function notify(input: NotifyInput) {
  return prisma.notification.create({
    data: {
      employeeId: input.employeeId,
      type: input.type,
      title: input.title,
      message: input.message,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
    },
  });
}
