import type { AssetCondition, AssetStatus } from "./api";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const dateTime = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
});
const dateOnly = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

export function formatCurrency(value: string | number) {
  return currency.format(typeof value === "number" ? value : Number(value));
}

export function formatDate(value: string | null | undefined) {
  return value ? dateOnly.format(new Date(value)) : "—";
}

export function formatDateTime(value: string | null | undefined) {
  return value ? dateTime.format(new Date(value)) : "—";
}

export function assetStatusLabel(status: AssetStatus) {
  const labels: Record<AssetStatus, string> = {
    AVAILABLE: "Available",
    ALLOCATED: "Allocated",
    RESERVED: "Reserved",
    UNDER_MAINTENANCE: "Under maintenance",
    LOST: "Lost",
    RETIRED: "Retired",
    DISPOSED: "Disposed",
  };
  return labels[status];
}

export function assetStatusTone(status: AssetStatus) {
  if (status === "AVAILABLE") return "success";
  if (status === "ALLOCATED") return "info";
  if (status === "UNDER_MAINTENANCE") return "warning";
  return "danger";
}

export function assetConditionLabel(condition: AssetCondition) {
  const labels: Record<AssetCondition, string> = {
    NEW: "New",
    GOOD: "Good",
    FAIR: "Fair",
    POOR: "Poor",
  };
  return labels[condition];
}
