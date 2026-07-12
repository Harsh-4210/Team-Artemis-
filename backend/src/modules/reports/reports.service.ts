import { AllocationStatus, AssetStatus, BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "../../config/prisma";
import { AppError } from "../../utils/app-error";

export async function dashboardKpis() {
  const now = new Date(); const sevenDays = new Date(now); sevenDays.setDate(now.getDate() + 7);
  const [assetsAvailable, assetsAllocated, maintenanceToday, activeBookings, pendingTransfers, upcomingReturns, overdueReturns] = await Promise.all([
    prisma.asset.count({ where: { status: AssetStatus.AVAILABLE } }),
    prisma.asset.count({ where: { status: AssetStatus.ALLOCATED } }),
    prisma.maintenanceRequest.count({ where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) } } }),
    prisma.booking.count({ where: { status: { in: [BookingStatus.UPCOMING, BookingStatus.ONGOING] }, endTime: { gt: now } } }),
    prisma.transferRequest.count({ where: { status: "REQUESTED" } }),
    prisma.allocation.count({ where: { status: AllocationStatus.ACTIVE, expectedReturnDate: { gte: now, lte: sevenDays } } }),
    prisma.allocation.count({ where: { status: AllocationStatus.ACTIVE, expectedReturnDate: { lt: now } } }),
  ]);
  return { assetsAvailable, assetsAllocated, maintenanceToday, activeBookings, pendingTransfers, upcomingReturns, overdueReturns };
}

export async function utilization() {
  const assets = await prisma.asset.findMany({ include: { allocations: { select: { allocatedAt: true, returnedAt: true, status: true } } }, orderBy: { name: "asc" } });
  const now = new Date();
  return assets.map((asset) => {
    const allocationDays = asset.allocations.reduce((sum, allocation) => sum + Math.max(0, Math.ceil(((allocation.returnedAt ?? now).getTime() - allocation.allocatedAt.getTime()) / 86400000)), 0);
    return { id: asset.id, assetTag: asset.assetTag, name: asset.name, status: asset.status, allocationDays, allocationCount: asset.allocations.length, idle: allocationDays === 0 };
  }).sort((a, b) => b.allocationDays - a.allocationDays);
}

export async function maintenanceFrequency() {
  const rows = await prisma.maintenanceRequest.groupBy({ by: ["assetId"], _count: { id: true }, orderBy: { _count: { id: "desc" } } });
  const assets = await prisma.asset.findMany({ where: { id: { in: rows.map((r) => r.assetId) } }, include: { category: { select: { name: true } } } });
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return rows.map((row) => ({ assetId: row.assetId, assetName: byId.get(row.assetId)?.name ?? "Unknown asset", category: byId.get(row.assetId)?.category.name ?? "Uncategorised", requestCount: row._count.id }));
}

export async function departmentAllocation() {
  const departments = await prisma.department.findMany({ include: { employees: { include: { allocations: { where: { status: AllocationStatus.ACTIVE }, select: { id: true } } } } }, orderBy: { name: "asc" } });
  return departments.map((department) => ({ departmentId: department.id, department: department.name, allocatedAssets: department.employees.reduce((count, employee) => count + employee.allocations.length, 0), employees: department.employees.length }));
}

export async function bookingHeatmap() {
  const bookings = await prisma.booking.findMany({ where: { status: { not: BookingStatus.CANCELLED } }, select: { startTime: true } });
  const cells = Array.from({ length: 7 }, (_, day) => Array.from({ length: 24 }, (_, hour) => ({ day, hour, count: 0 })));
  bookings.forEach((booking) => { const date = booking.startTime; const row = cells[date.getDay()]; const cell = row?.[date.getHours()]; if (cell) cell.count += 1; });
  return cells.flat();
}

function csv(rows: Record<string, unknown>[]) { const first = rows[0]; if (!first) return "No data\n"; const headers = Object.keys(first); const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n"); }
export async function exportReport(type: string) {
  if (type === "utilization") return csv(await utilization());
  if (type === "maintenance") return csv(await maintenanceFrequency());
  if (type === "department") return csv(await departmentAllocation());
  if (type === "heatmap") return csv(await bookingHeatmap());
  throw new AppError(400, "INVALID_REPORT_TYPE", "Report type must be utilization, maintenance, department, or heatmap");
}
