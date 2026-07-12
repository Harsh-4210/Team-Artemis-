import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, Clock3, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "../../../components/shared/Feedback";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/utils";
import {
  allocationsApi,
  allocationsQueryKeys,
  type Allocation,
  type AllocationStatus,
} from "../api";
import {
  allocationStatusLabel,
  allocationStatusTone,
  formatAllocationDate,
  formatAllocationDateTime,
} from "../utils";
import { ReturnAllocationDialog } from "../components/ReturnAllocationDialog";

const tabs: Array<{ value: "ACTIVE" | "RETURNED" | "OVERDUE"; label: string }> =
  [
    { value: "ACTIVE", label: "Active" },
    { value: "RETURNED", label: "Returned" },
    { value: "OVERDUE", label: "Overdue" },
  ];

export function AllocationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"ACTIVE" | "RETURNED" | "OVERDUE">("ACTIVE");
  const [returnTarget, setReturnTarget] = useState<Allocation | null>(null);

  const query = useQuery({
    queryKey: allocationsQueryKeys.list({
      status: tab as AllocationStatus,
      limit: 100,
    }),
    queryFn: () =>
      allocationsApi.listAllocations({
        status: tab as AllocationStatus,
        limit: 100,
      }),
  });

  const returnMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: {
        conditionOnReturn: "NEW" | "GOOD" | "FAIR" | "POOR";
        notes?: string;
      };
    }) => allocationsApi.returnAllocation(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.all,
      });
      toast.success("Allocation returned");
      setReturnTarget(null);
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Allocation could not be returned.")),
  });

  const allocations = query.data?.items ?? [];

  const grouped = useMemo(() => {
    if (tab === "ACTIVE") {
      return allocations.filter((allocation) => !allocation.isOverdue);
    }
    if (tab === "OVERDUE") {
      return allocations.filter((allocation) => allocation.isOverdue);
    }
    return allocations;
  }, [allocations, tab]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Allocations"
        description="Track active custody, returned assets, and overdue items in one place."
        actions={
          <>
            <Button variant="secondary" onClick={() => void query.refetch()}>
              <RefreshCcw
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Refresh
            </Button>
            <Button onClick={() => navigate("/app/allocations/new")}>
              <ArrowLeftRight
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              New allocation
            </Button>
          </>
        }
      />

      <div className="flex flex-wrap gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-2">
        {tabs.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTab(option.value)}
            className={
              tab === option.value
                ? "rounded-lg bg-white px-4 py-2 text-sm font-medium text-[var(--ink)] shadow-sm"
                : "rounded-lg px-4 py-2 text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      {query.isLoading ? (
        <PageSkeleton />
      ) : query.isError ? (
        <ErrorState
          message={getErrorMessage(
            query.error,
            "Allocations could not be loaded.",
          )}
          onRetry={() => void query.refetch()}
        />
      ) : grouped.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)]">
          <EmptyState
            title={
              tab === "ACTIVE"
                ? "No active allocations"
                : tab === "RETURNED"
                  ? "No returned allocations"
                  : "No overdue allocations"
            }
            description="Create an allocation to populate this table."
            icon={Clock3}
            action={
              <Button onClick={() => navigate("/app/allocations/new")}>
                New allocation
              </Button>
            }
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[var(--surface)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Allocated</th>
                <th className="px-4 py-3">Expected return</th>
                <th className="px-4 py-3">Returned</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((allocation) => (
                <tr
                  key={allocation.id}
                  className={
                    allocation.isOverdue
                      ? "border-t border-[var(--border)] bg-[var(--danger-soft)]/30"
                      : "border-t border-[var(--border)]"
                  }
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--ink)]">
                      {allocation.asset.assetTag}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {allocation.asset.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {allocation.employee.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatAllocationDateTime(allocation.allocatedAt)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatAllocationDate(allocation.expectedReturnDate)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatAllocationDateTime(allocation.returnedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      tone={
                        allocation.isOverdue
                          ? "danger"
                          : allocationStatusTone(allocation.status)
                      }
                    >
                      {allocation.isOverdue
                        ? "Overdue"
                        : allocationStatusLabel(allocation.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {allocation.status === "ACTIVE" ||
                    allocation.status === "OVERDUE" ? (
                      <Button
                        variant="secondary"
                        className="ml-auto"
                        onClick={() => setReturnTarget(allocation)}
                      >
                        Return
                      </Button>
                    ) : (
                      <span className="text-xs text-[var(--muted)]">
                        No action
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ReturnAllocationDialog
        open={Boolean(returnTarget)}
        allocation={returnTarget}
        loading={returnMutation.isPending}
        onClose={() => setReturnTarget(null)}
        onSubmit={(values) =>
          returnTarget &&
          returnMutation.mutate({ id: returnTarget.id, payload: values })
        }
      />
    </div>
  );
}
