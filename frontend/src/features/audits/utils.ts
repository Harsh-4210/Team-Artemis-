import type { AuditCycleListItem, AuditCycleStatus, AuditRecordStatus } from "./api";

const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });
const dateTime = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export function formatDate(value: string | null | undefined) {
  return value ? dateOnly.format(new Date(value)) : "—";
}

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "—";
}

export const cycleStatusLabel: Record<AuditCycleStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  CLOSED: "Closed",
};

export const cycleStatusTone: Record<AuditCycleStatus, "neutral" | "info" | "success"> = {
  DRAFT: "neutral",
  ACTIVE: "info",
  CLOSED: "success",
};

export const recordStatusLabel: Record<AuditRecordStatus, string> = {
  PENDING: "Pending",
  VERIFIED: "Verified",
  MISSING: "Missing",
  DAMAGED: "Damaged",
};

export const recordStatusTone: Record<AuditRecordStatus, "neutral" | "success" | "danger" | "warning"> = {
  PENDING: "neutral",
  VERIFIED: "success",
  MISSING: "danger",
  DAMAGED: "warning",
};

/**
 * Describes a cycle's scope in plain English, matching the Phase 1 backend interpretation exactly:
 * department scope = assets on an active/overdue allocation to someone in that department;
 * location scope = exact Asset.location match; both = intersection; neither = org-wide.
 */
export function describeScope(cycle: Pick<AuditCycleListItem, "scopeDepartment" | "scopeLocation">) {
  const parts: string[] = [];
  if (cycle.scopeDepartment) parts.push(`Dept: ${cycle.scopeDepartment.name}`);
  if (cycle.scopeLocation) parts.push(`Location: ${cycle.scopeLocation}`);
  return parts.length > 0 ? parts.join(" · ") : "Organization-wide";
}

export function scopeExplanation(cycle: Pick<AuditCycleListItem, "scopeDepartment" | "scopeLocation">) {
  if (cycle.scopeDepartment && cycle.scopeLocation) {
    return `Only assets currently allocated to someone in ${cycle.scopeDepartment.name} AND located at "${cycle.scopeLocation}" are included.`;
  }
  if (cycle.scopeDepartment) {
    return `Only assets currently allocated (active or overdue) to an employee in ${cycle.scopeDepartment.name} are included. Unallocated assets have no department signal, so they're excluded.`;
  }
  if (cycle.scopeLocation) {
    return `Only assets whose location exactly matches "${cycle.scopeLocation}" are included.`;
  }
  return "Every asset in the organization is included, except assets already Lost, Retired, or Disposed.";
}
