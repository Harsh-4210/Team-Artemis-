import { AssetStatus, BookingStatus, EmployeeStatus, Prisma, Role } from "@prisma/client";

import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";
import { logActivity } from "../activity-logs/activity-logs.service";
import { notify } from "../notifications/notify";
import type {
  CreateBookingInput,
  ListBookingsQuery,
  RescheduleBookingInput,
} from "./bookings.schema";

const bookingInclude = {
  asset: {
    select: {
      id: true,
      assetTag: true,
      name: true,
      location: true,
      status: true,
      category: { select: { id: true, name: true } },
    },
  },
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      department: { select: { id: true, name: true, code: true } },
    },
  },
} satisfies Prisma.BookingInclude;

const MANAGER_ROLES: Role[] = [Role.ADMIN, Role.ASSET_MANAGER, Role.DEPARTMENT_HEAD];

// Lazily reconcile UPCOMING <-> ONGOING <-> COMPLETED so lists show accurate statuses
// without a background scheduler.
async function reconcileStatuses() {
  const now = new Date();
  await prisma.booking.updateMany({
    where: {
      status: BookingStatus.UPCOMING,
      startTime: { lte: now },
      endTime: { gt: now },
    },
    data: { status: BookingStatus.ONGOING },
  });
  await prisma.booking.updateMany({
    where: {
      status: { in: [BookingStatus.UPCOMING, BookingStatus.ONGOING] },
      endTime: { lte: now },
    },
    data: { status: BookingStatus.COMPLETED },
  });
}

async function assertAssetIsBookable(assetId: string) {
  const asset = await prisma.asset.findUnique({
    where: { id: assetId },
    select: { id: true, isBookable: true, status: true, name: true, assetTag: true },
  });
  if (!asset) {
    throw new AppError(404, "ASSET_NOT_FOUND", "The requested asset does not exist");
  }
  if (!asset.isBookable) {
    throw new AppError(400, "ASSET_NOT_BOOKABLE", `${asset.name} is not marked as a bookable resource`);
  }
  if (
    asset.status === AssetStatus.LOST ||
    asset.status === AssetStatus.RETIRED ||
    asset.status === AssetStatus.DISPOSED
  ) {
    throw new AppError(400, "ASSET_UNAVAILABLE", `${asset.name} is not available for booking`);
  }
  if (asset.status === AssetStatus.UNDER_MAINTENANCE) {
    throw new AppError(409, "ASSET_UNDER_MAINTENANCE", `${asset.name} is currently under maintenance`);
  }
  return asset;
}

// Overlap uses a half-open interval: [start, end). Exact abutting slots (10:00-11:00 after
// 09:00-10:00) are allowed because equality does not satisfy strict inequalities on both sides.
async function assertNoOverlap({
  assetId,
  startTime,
  endTime,
  excludeBookingId,
}: {
  assetId: string;
  startTime: Date;
  endTime: Date;
  excludeBookingId?: string;
}) {
  const conflict = await prisma.booking.findFirst({
    where: {
      assetId,
      id: excludeBookingId ? { not: excludeBookingId } : undefined,
      status: { in: [BookingStatus.UPCOMING, BookingStatus.ONGOING] },
      AND: [{ startTime: { lt: endTime } }, { endTime: { gt: startTime } }],
    },
    include: bookingInclude,
    orderBy: { startTime: "asc" },
  });

  if (conflict) {
    throw new AppError(
      409,
      "BOOKING_OVERLAP",
      "The requested time overlaps with an existing booking",
      {
        conflictingBooking: {
          id: conflict.id,
          startTime: conflict.startTime,
          endTime: conflict.endTime,
          purpose: conflict.purpose,
          status: conflict.status,
          asset: conflict.asset,
          employee: conflict.employee,
        },
      },
    );
  }
}

export async function listBookings(
  query: ListBookingsQuery,
  actor: { employeeId: string; role: Role },
) {
  await reconcileStatuses();

  const restrictToSelf =
    query.scope === "mine" || (query.scope !== "all" && !MANAGER_ROLES.includes(actor.role));
  const employeeId = restrictToSelf ? actor.employeeId : query.employeeId;

  return prisma.booking.findMany({
    where: {
      assetId: query.assetId,
      employeeId,
      status: query.status,
      startTime: query.from ? { gte: new Date(query.from) } : undefined,
      endTime: query.to ? { lte: new Date(query.to) } : undefined,
    },
    include: bookingInclude,
    orderBy: [{ startTime: "asc" }],
  });
}

export async function listBookableResources() {
  return prisma.asset.findMany({
    where: {
      isBookable: true,
      status: {
        notIn: [
          AssetStatus.LOST,
          AssetStatus.RETIRED,
          AssetStatus.DISPOSED,
          AssetStatus.UNDER_MAINTENANCE,
        ],
      },
    },
    select: {
      id: true,
      assetTag: true,
      name: true,
      location: true,
      status: true,
      category: { select: { id: true, name: true } },
    },
    orderBy: [{ name: "asc" }],
  });
}

export async function createBooking(
  input: CreateBookingInput,
  actor: { employeeId: string; role: Role },
) {
  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);

  if (endTime.getTime() <= Date.now()) {
    throw new AppError(400, "BOOKING_IN_PAST", "Bookings cannot end in the past");
  }

  await assertAssetIsBookable(input.assetId);

  const employeeId =
    input.employeeId && MANAGER_ROLES.includes(actor.role) ? input.employeeId : actor.employeeId;

  if (employeeId !== actor.employeeId) {
    const target = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, status: true },
    });
    if (!target || target.status !== EmployeeStatus.ACTIVE) {
      throw new AppError(400, "INVALID_BOOKING_EMPLOYEE", "The selected employee is not active");
    }
  }

  await assertNoOverlap({ assetId: input.assetId, startTime, endTime });

  const booking = await prisma.booking.create({
    data: {
      assetId: input.assetId,
      employeeId,
      startTime,
      endTime,
      purpose: input.purpose,
      status: startTime <= new Date() ? BookingStatus.ONGOING : BookingStatus.UPCOMING,
    },
    include: bookingInclude,
  });
  await Promise.all([
    notify({ employeeId, type: "BOOKING_CONFIRMED", title: "Booking confirmed", message: `${booking.asset.name} is booked for ${booking.startTime.toLocaleString()}.`, relatedEntityType: "BOOKING", relatedEntityId: booking.id }),
    logActivity({ employeeId: actor.employeeId, action: "BOOKING_CREATED", entityType: "BOOKING", entityId: booking.id, details: { assetId: booking.assetId } }),
  ]);
  return booking;
}

export async function cancelBooking(id: string, actor: { employeeId: string; role: Role }) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }

  const owns = booking.employeeId === actor.employeeId;
  const isManager = MANAGER_ROLES.includes(actor.role);
  if (!owns && !isManager) {
    throw new AppError(403, "FORBIDDEN", "You cannot cancel a booking you did not create");
  }

  if (booking.status === BookingStatus.COMPLETED) {
    throw new AppError(409, "BOOKING_ALREADY_COMPLETED", "Completed bookings cannot be cancelled");
  }
  if (booking.status === BookingStatus.CANCELLED) {
    throw new AppError(409, "BOOKING_ALREADY_CANCELLED", "This booking is already cancelled");
  }

  return prisma.booking.update({
    where: { id },
    data: { status: BookingStatus.CANCELLED },
    include: bookingInclude,
  });
}

export async function rescheduleBooking(
  id: string,
  input: RescheduleBookingInput,
  actor: { employeeId: string; role: Role },
) {
  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    throw new AppError(404, "BOOKING_NOT_FOUND", "Booking not found");
  }

  const owns = booking.employeeId === actor.employeeId;
  const isManager = MANAGER_ROLES.includes(actor.role);
  if (!owns && !isManager) {
    throw new AppError(403, "FORBIDDEN", "You cannot reschedule a booking you did not create");
  }

  if (booking.status === BookingStatus.CANCELLED || booking.status === BookingStatus.COMPLETED) {
    throw new AppError(
      409,
      "BOOKING_LOCKED",
      `Bookings that are ${booking.status.toLowerCase()} cannot be rescheduled`,
    );
  }

  const startTime = new Date(input.startTime);
  const endTime = new Date(input.endTime);
  if (endTime.getTime() <= Date.now()) {
    throw new AppError(400, "BOOKING_IN_PAST", "Bookings cannot end in the past");
  }

  await assertNoOverlap({
    assetId: booking.assetId,
    startTime,
    endTime,
    excludeBookingId: booking.id,
  });

  return prisma.booking.update({
    where: { id },
    data: {
      startTime,
      endTime,
      purpose: input.purpose ?? booking.purpose,
      status: startTime <= new Date() ? BookingStatus.ONGOING : BookingStatus.UPCOMING,
    },
    include: bookingInclude,
  });
}
