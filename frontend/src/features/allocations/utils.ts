import type { AllocationStatus } from "./api";

const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function formatAllocationDate(value: string | null | undefined) {
  return value ? dateOnly.format(new Date(value)) : "—";
}

export function formatAllocationDateTime(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function allocationStatusLabel(status: AllocationStatus) {
  const labels: Record<AllocationStatus, string> = {
    ACTIVE: "Active",
    RETURNED: "Returned",
    OVERDUE: "Overdue",
  };
  return labels[status];
}

export function allocationStatusTone(status: AllocationStatus) {
  if (status === "ACTIVE") return "info";
  if (status === "RETURNED") return "neutral";
  return "danger";
}
