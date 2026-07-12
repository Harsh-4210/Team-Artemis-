import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeftRight, RefreshCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import {
  EmptyState,
  ErrorState,
  PageSkeleton,
} from "../../../components/shared/Feedback";
import { Modal } from "../../../components/shared/Modal";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { Field, SelectField } from "../../../components/ui/Field";
import { getErrorMessage } from "../../../lib/utils";
import { useAuthStore } from "../../../stores/authStore";
import {
  allocationsApi,
  allocationsQueryKeys,
  type TransferRequest,
  type TransferStatus,
} from "../api";
import { formatAllocationDateTime } from "../utils";

const tabs: Array<{ value: TransferStatus | "ALL"; label: string }> = [
  { value: "REQUESTED", label: "Pending" },
  { value: "COMPLETED", label: "Completed" },
  { value: "REJECTED", label: "Rejected" },
  { value: "ALL", label: "All" },
];

function transferTone(status: TransferStatus) {
  if (status === "REQUESTED") return "warning" as const;
  if (status === "COMPLETED") return "success" as const;
  if (status === "REJECTED") return "danger" as const;
  return "neutral" as const;
}

export function TransfersPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const role = useAuthStore((state) => state.user?.role);
  const canDecide =
    role === "ADMIN" ||
    role === "ASSET_MANAGER" ||
    role === "DEPARTMENT_HEAD";

  const [tab, setTab] = useState<TransferStatus | "ALL">("REQUESTED");
  const [rejectTarget, setRejectTarget] = useState<TransferRequest | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");

  const filters = useMemo(
    () => ({
      status: tab === "ALL" ? undefined : tab,
      limit: 50,
    }),
    [tab],
  );

  const query = useQuery({
    queryKey: allocationsQueryKeys.transfers(filters),
    queryFn: () => allocationsApi.listTransfers(filters),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => allocationsApi.approveTransfer(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
      await queryClient.invalidateQueries({
        queryKey: allocationsQueryKeys.all,
      });
      toast.success("Transfer approved");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Transfer could not be approved.")),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      allocationsApi.rejectTransfer(id, reason),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["transfers"] });
      toast.success("Transfer rejected");
      setRejectTarget(null);
      setRejectReason("");
    },
    onError: (error) =>
      toast.error(getErrorMessage(error, "Transfer could not be rejected.")),
  });

  const items = query.data?.items ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transfers"
        description="Review custody transfer requests and move assets between employees."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void query.refetch()}
            >
              <RefreshCcw
                aria-hidden="true"
                className="size-4"
                strokeWidth={1.75}
              />
              Refresh
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate("/allocations/new")}
            >
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
            "Transfers could not be loaded.",
          )}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)]">
          <EmptyState
            title="No transfer requests"
            description="When an allocation is blocked, request a transfer to move the asset."
            icon={ArrowLeftRight}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[1080px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[var(--surface)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">From</th>
                <th className="px-4 py-3">To</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Requested</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((transfer) => (
                <tr
                  key={transfer.id}
                  className="border-t border-[var(--border)]"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--ink)]">
                      {transfer.asset.assetTag}
                    </div>
                    <div className="text-xs text-[var(--muted)]">
                      {transfer.asset.name}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {transfer.fromEmployee.name}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {transfer.toEmployee.name}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-[var(--muted)]">
                    {transfer.reason}
                    {transfer.decisionNotes ? (
                      <div className="mt-1 text-xs">
                        Decision: {transfer.decisionNotes}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatAllocationDateTime(transfer.requestedAt)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={transferTone(transfer.status)}>
                      {transfer.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {canDecide && transfer.status === "REQUESTED" ? (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setRejectTarget(transfer)}
                        >
                          Reject
                        </Button>
                        <Button
                          loading={approveMutation.isPending}
                          onClick={() => approveMutation.mutate(transfer.id)}
                        >
                          Approve
                        </Button>
                      </div>
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

      <Modal
        open={Boolean(rejectTarget)}
        onClose={() => {
          setRejectTarget(null);
          setRejectReason("");
        }}
        title="Reject transfer"
        description={
          rejectTarget
            ? `${rejectTarget.asset.assetTag} · ${rejectTarget.fromEmployee.name} → ${rejectTarget.toEmployee.name}`
            : undefined
        }
      >
        <div className="grid gap-4">
          <Field
            label="Rejection reason"
            value={rejectReason}
            onChange={(event) => setRejectReason(event.target.value)}
            placeholder="Explain why this transfer is declined"
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                setRejectTarget(null);
                setRejectReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              loading={rejectMutation.isPending}
              disabled={rejectReason.trim().length < 3}
              onClick={() => {
                if (!rejectTarget) return;
                rejectMutation.mutate({
                  id: rejectTarget.id,
                  reason: rejectReason.trim(),
                });
              }}
            >
              Reject transfer
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
