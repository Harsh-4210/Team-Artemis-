import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Activity, History, Wrench } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";

import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "../../../components/shared/Feedback";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/utils";
import { assetsApi, assetsQueryKeys } from "../api";
import {
  assetConditionLabel,
  assetStatusLabel,
  assetStatusTone,
  formatCurrency,
  formatDate,
  formatDateTime,
} from "../utils";

type TabKey = "allocations" | "maintenance";

export function AssetDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [tab, setTab] = useState<TabKey>("allocations");

  const assetQuery = useQuery({
    queryKey: assetsQueryKeys.detail(id ?? ""),
    queryFn: () => assetsApi.getAsset(id ?? ""),
    enabled: Boolean(id),
  });

  const asset = assetQuery.data;
  const activeAllocation = useMemo(
    () => asset?.currentAllocation ?? null,
    [asset],
  );

  if (!id) {
    return (
      <ErrorState
        message="Asset id missing."
        onRetry={() => navigate("/assets")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={asset?.name ?? "Asset details"}
        description={
          asset
            ? `${asset.assetTag} · ${asset.category?.name ?? "Uncategorized"}`
            : "Inspect asset history and current custody."
        }
        actions={
          <Button variant="secondary" onClick={() => navigate("/assets")}>
            <ArrowLeft
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
            Back
          </Button>
        }
      />

      {assetQuery.isLoading ? (
        <PageSkeleton />
      ) : assetQuery.isError ? (
        <ErrorState
          message={getErrorMessage(
            assetQuery.error,
            "Asset could not be loaded.",
          )}
          onRetry={() => void assetQuery.refetch()}
        />
      ) : asset ? (
        <>
          <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 md:grid-cols-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Status
              </p>
              <Badge tone={assetStatusTone(asset.status)}>
                {assetStatusLabel(asset.status)}
              </Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Holder
              </p>
              <p className="mt-1 font-medium text-[var(--ink)]">
                {activeAllocation?.employee.name ?? "Unassigned"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Condition
              </p>
              <p className="mt-1 font-medium text-[var(--ink)]">
                {assetConditionLabel(asset.condition)}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-[var(--muted)]">
                Value
              </p>
              <p className="mt-1 font-medium text-[var(--ink)]">
                {formatCurrency(asset.acquisitionCost)}
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
            <div className="flex items-center gap-1 border-b border-[var(--border)] p-1">
              {(
                [
                  {
                    key: "allocations",
                    label: "Allocation history",
                    icon: History,
                  },
                  {
                    key: "maintenance",
                    label: "Maintenance history",
                    icon: Wrench,
                  },
                ] as const
              ).map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setTab(option.key)}
                  className={
                    tab === option.key
                      ? "flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm"
                      : "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
                  }
                >
                  <option.icon aria-hidden="true" className="size-4" />
                  {option.label}
                </button>
              ))}
            </div>

            {tab === "allocations" ? (
              asset.allocations.length === 0 ? (
                <EmptyState
                  title="No allocations yet"
                  description="This asset has not been allocated before."
                  icon={Activity}
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[840px] border-collapse text-sm">
                    <thead>
                      <tr className="bg-[var(--surface)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        <th className="px-4 py-3">Employee</th>
                        <th className="px-4 py-3">Allocated by</th>
                        <th className="px-4 py-3">Allocated</th>
                        <th className="px-4 py-3">Expected return</th>
                        <th className="px-4 py-3">Returned</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asset.allocations.map((allocation) => (
                        <tr
                          key={allocation.id}
                          className="border-t border-[var(--border)]"
                        >
                          <td className="px-4 py-3 text-[var(--ink)]">
                            {allocation.employee.name}
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {allocation.allocatedBy.name}
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {formatDateTime(allocation.allocatedAt)}
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {formatDate(allocation.expectedReturnDate)}
                          </td>
                          <td className="px-4 py-3 text-[var(--muted)]">
                            {formatDateTime(allocation.returnedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <Badge
                              tone={
                                allocation.status === "RETURNED"
                                  ? "neutral"
                                  : allocation.status === "OVERDUE"
                                    ? "danger"
                                    : "info"
                              }
                            >
                              {allocation.status}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : asset.maintenanceRequests.length === 0 ? (
              <EmptyState
                title="No maintenance history"
                description="Maintenance requests for this asset will appear here."
                icon={Wrench}
              />
            ) : (
              <div className="space-y-3 p-4">
                {asset.maintenanceRequests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-xl border border-[var(--border)] bg-white p-4"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-[var(--ink)]">
                          {request.description}
                        </p>
                        <p className="mt-1 text-sm text-[var(--muted)]">
                          Raised by {request.raisedBy.name} ·{" "}
                          {formatDateTime(request.createdAt)}
                        </p>
                      </div>
                      <Badge tone="warning">{request.status}</Badge>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
