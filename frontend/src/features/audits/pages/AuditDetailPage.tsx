import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowLeft, CheckCircle2, HelpCircle, Lock, Play, UserPlus } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";

import { ConfirmDialog } from "../../../components/shared/ConfirmDialog";
import { EmptyState, ErrorState, PageSkeleton } from "../../../components/shared/Feedback";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/utils";
import { useAuthStore } from "../../../stores/authStore";
import { orgApi, orgQueryKeys } from "../../org-setup/api";
import { auditsApi, auditsQueryKeys, type AuditCloseResponse, type AuditRecord, type AuditRecordStatus } from "../api";
import { AssignAuditorsDialog } from "../components/AssignAuditorsDialog";
import { DiscrepancySummaryDialog } from "../components/DiscrepancySummaryDialog";
import { RecordDecisionDialog } from "../components/RecordDecisionDialog";
import {
  cycleStatusLabel,
  cycleStatusTone,
  formatDate,
  formatDateTime,
  recordStatusLabel,
  recordStatusTone,
  scopeExplanation,
} from "../utils";

type Mode = Extract<AuditRecordStatus, "VERIFIED" | "MISSING" | "DAMAGED">;

export function AuditDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMIN";
  const isAssetManager = user?.role === "ASSET_MANAGER";
  const isManager = isAdmin || isAssetManager;

  const [assignOpen, setAssignOpen] = useState(false);
  const [activateConfirmOpen, setActivateConfirmOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [decisionTarget, setDecisionTarget] = useState<{ record: AuditRecord; mode: Mode } | null>(null);
  const [closeResult, setCloseResult] = useState<AuditCloseResponse | null>(null);
  const [summaryViewOpen, setSummaryViewOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: auditsQueryKeys.detail(id ?? ""),
    queryFn: () => auditsApi.getCycle(id ?? ""),
    enabled: Boolean(id),
  });

  const cycle = detailQuery.data?.cycle;
  const summary = detailQuery.data?.summary;

  const isAssignedAuditor = useMemo(
    () => {
      if (!cycle || !user) return false;

      // `employeeId` is the canonical match. Email keeps the UI usable if an
      // older persisted session predates that field; the API still authorizes
      // every record update using the JWT employee id.
      return cycle.assignments.some(
        (assignment) =>
          assignment.auditorId === user.employeeId ||
          assignment.auditor.email.toLowerCase() === user.email.toLowerCase(),
      );
    },
    [cycle, user],
  );
  const canRecord = isManager || isAssignedAuditor;

  const employeesQuery = useQuery({
    queryKey: [...orgQueryKeys.employees, "active"],
    queryFn: () => orgApi.listEmployees({ status: "ACTIVE" }),
    enabled: isAdmin,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: auditsQueryKeys.all });

  const assignMutation = useMutation({
    mutationFn: (auditorIds: string[]) => auditsApi.assignAuditors(id ?? "", auditorIds),
    onSuccess: async () => {
      await invalidate();
      toast.success("Auditors assigned");
      setAssignOpen(false);
    },
    onError: (error) => toast.error(getErrorMessage(error, "Auditors could not be assigned.")),
  });

  const activateMutation = useMutation({
    mutationFn: () => auditsApi.activateCycle(id ?? ""),
    onSuccess: async () => {
      await invalidate();
      toast.success("Audit cycle activated");
      setActivateConfirmOpen(false);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Audit cycle could not be activated."));
      setActivateConfirmOpen(false);
    },
  });

  const closeMutation = useMutation({
    mutationFn: () => auditsApi.closeCycle(id ?? ""),
    onSuccess: async (result) => {
      await invalidate();
      setCloseConfirmOpen(false);
      setCloseResult(result);
      setSummaryViewOpen(true);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Audit cycle could not be closed."));
      setCloseConfirmOpen(false);
    },
  });

  const recordMutation = useMutation({
    mutationFn: ({ recordId, status, notes }: { recordId: string; status: AuditRecordStatus; notes?: string }) =>
      auditsApi.recordStatus(recordId, { status, notes }),
    onSuccess: async () => {
      await invalidate();
      toast.success("Audit record updated");
      setDecisionTarget(null);
    },
    onError: (error) => toast.error(getErrorMessage(error, "Audit record could not be updated.")),
  });

  if (!id) {
    return <ErrorState message="Audit cycle id missing." onRetry={() => navigate("/app/audits")} />;
  }

  if (detailQuery.isLoading) return <PageSkeleton />;
  if (detailQuery.isError) {
    return (
      <ErrorState
        message={getErrorMessage(detailQuery.error, "Audit cycle could not be loaded.")}
        onRetry={() => void detailQuery.refetch()}
      />
    );
  }
  if (!cycle || !summary) return null;

  const alreadyAssignedIds = cycle.assignments.map((assignment) => assignment.auditorId);

  // Reconstructs the same shape the live close response returns, from data the detail endpoint
  // already has — used when reopening the discrepancy summary for a cycle closed in an earlier
  // session. The original close call's maintenanceRequestId isn't persisted anywhere to refetch,
  // so it's left null here; the summary dialog doesn't render that field, so nothing is faked.
  const derivedCloseView: AuditCloseResponse = {
    cycle,
    summary,
    missingAssets: cycle.records
      .filter((record) => record.status === "MISSING")
      .map((record) => ({ id: record.asset.id, assetTag: record.asset.assetTag, name: record.asset.name })),
    damagedAssets: cycle.records
      .filter((record) => record.status === "DAMAGED")
      .map((record) => ({
        id: record.asset.id,
        assetTag: record.asset.assetTag,
        name: record.asset.name,
        maintenanceRequestId: null,
      })),
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={cycle.name}
        description={scopeExplanation(cycle)}
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/app/audits")}>
              <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
              Back
            </Button>
            {isAdmin && cycle.status !== "CLOSED" ? (
              <Button variant="secondary" onClick={() => setAssignOpen(true)}>
                <UserPlus aria-hidden="true" className="size-4" strokeWidth={1.75} />
                Assign auditors
              </Button>
            ) : null}
            {isAdmin && cycle.status === "DRAFT" ? (
              <Button onClick={() => setActivateConfirmOpen(true)}>
                <Play aria-hidden="true" className="size-4" strokeWidth={1.75} />
                Activate cycle
              </Button>
            ) : null}
            {isAdmin && cycle.status === "ACTIVE" ? (
              <Button variant="danger" onClick={() => setCloseConfirmOpen(true)}>
                <Lock aria-hidden="true" className="size-4" strokeWidth={1.75} />
                Close cycle
              </Button>
            ) : null}
            {cycle.status === "CLOSED" ? (
              <Button
                variant="secondary"
                onClick={() => {
                  setCloseResult(derivedCloseView);
                  setSummaryViewOpen(true);
                }}
              >
                View discrepancy summary
              </Button>
            ) : null}
          </>
        }
      />

      <section className="grid gap-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Status</p>
          <Badge tone={cycleStatusTone[cycle.status]}>{cycleStatusLabel[cycle.status]}</Badge>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Dates</p>
          <p className="mt-1 font-medium text-[var(--ink)]">
            {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Created by</p>
          <p className="mt-1 font-medium text-[var(--ink)]">{cycle.createdBy.name}</p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--muted)]">Closed</p>
          <p className="mt-1 font-medium text-[var(--ink)]">{cycle.closedAt ? formatDateTime(cycle.closedAt) : "—"}</p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Verified" value={summary.verified} tone="text-[color-mix(in_oklch,var(--success)_60%,black)]" />
        <SummaryCard label="Missing" value={summary.missing} tone="text-[var(--danger)]" />
        <SummaryCard label="Damaged" value={summary.damaged} tone="text-[color-mix(in_oklch,var(--warning)_68%,black)]" />
        <SummaryCard label="Pending" value={summary.pending} tone="text-[var(--muted)]" />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-white p-5">
        <h2 className="text-sm font-semibold text-[var(--ink)]">Assigned auditors</h2>
        {cycle.assignments.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No auditors assigned yet.</p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {cycle.assignments.map((assignment) => (
              <li
                key={assignment.id}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-medium text-[var(--ink)]"
              >
                {assignment.auditor.name}
              </li>
            ))}
          </ul>
        )}
      </section>

      {cycle.status === "DRAFT" ? (
        <div className="rounded-xl border border-[var(--border)]">
          <EmptyState
            title="Not activated yet"
            description="Records are created once this cycle is activated — one per in-scope asset, starting Pending."
            icon={Play}
          />
        </div>
      ) : cycle.records.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)]">
          <EmptyState
            title="No assets in scope"
            description="No assets matched this cycle's scope when it was activated."
            icon={AlertTriangle}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[860px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[var(--surface)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3">Asset</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Notes</th>
                <th className="px-4 py-3">Recorded by</th>
                {cycle.status === "ACTIVE" ? <th className="px-4 py-3 text-right">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {cycle.records.map((record) => (
                <tr key={record.id} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--ink)]">{record.asset.name}</div>
                    <div className="font-mono text-xs text-[var(--muted)]">{record.asset.assetTag}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{record.asset.location}</td>
                  <td className="px-4 py-3">
                    <Badge tone={recordStatusTone[record.status]}>{recordStatusLabel[record.status]}</Badge>
                  </td>
                  <td className="max-w-[220px] truncate px-4 py-3 text-[var(--muted)]" title={record.notes ?? undefined}>
                    {record.notes ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{record.auditor?.name ?? "—"}</td>
                  {cycle.status === "ACTIVE" ? (
                    <td className="px-4 py-3">
                      {canRecord ? (
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            className="h-9 px-2 text-xs"
                            onClick={() => setDecisionTarget({ record, mode: "VERIFIED" })}
                          >
                            <CheckCircle2 aria-hidden="true" className="size-4" strokeWidth={1.75} />
                            Verify
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-9 px-2 text-xs"
                            onClick={() => setDecisionTarget({ record, mode: "MISSING" })}
                          >
                            <HelpCircle aria-hidden="true" className="size-4" strokeWidth={1.75} />
                            Missing
                          </Button>
                          <Button
                            variant="ghost"
                            className="h-9 px-2 text-xs hover:text-[var(--danger)]"
                            onClick={() => setDecisionTarget({ record, mode: "DAMAGED" })}
                          >
                            <AlertTriangle aria-hidden="true" className="size-4" strokeWidth={1.75} />
                            Damaged
                          </Button>
                        </div>
                      ) : (
                        <span className="block text-right text-xs text-[var(--muted)]">Not assigned</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin ? (
        <AssignAuditorsDialog
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          employees={employeesQuery.data ?? []}
          alreadyAssignedIds={alreadyAssignedIds}
          submitting={assignMutation.isPending}
          onSubmit={(auditorIds) => assignMutation.mutateAsync(auditorIds)}
        />
      ) : null}

      <ConfirmDialog
        open={activateConfirmOpen}
        title="Activate this audit cycle?"
        description={`This creates a Pending audit record for every in-scope asset. ${scopeExplanation(cycle)}`}
        confirmLabel="Activate"
        loading={activateMutation.isPending}
        onClose={() => setActivateConfirmOpen(false)}
        onConfirm={() => activateMutation.mutate()}
      />

      <ConfirmDialog
        open={closeConfirmOpen}
        title="Close this audit cycle?"
        description="Missing assets will be marked Lost. Damaged assets will each get a new high-priority maintenance request. This cannot be undone."
        confirmLabel="Close cycle"
        loading={closeMutation.isPending}
        onClose={() => setCloseConfirmOpen(false)}
        onConfirm={() => closeMutation.mutate()}
      />

      <RecordDecisionDialog
        open={Boolean(decisionTarget)}
        mode={decisionTarget?.mode ?? "VERIFIED"}
        record={decisionTarget?.record ?? null}
        submitting={recordMutation.isPending}
        onClose={() => setDecisionTarget(null)}
        onConfirm={({ status, notes }) =>
          decisionTarget && recordMutation.mutate({ recordId: decisionTarget.record.id, status, notes })
        }
      />

      <DiscrepancySummaryDialog open={summaryViewOpen} result={closeResult} onClose={() => setSummaryViewOpen(false)} />
    </div>
  );
}

function SummaryCard({ label, value, tone = "text-[var(--ink)]" }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone}`}>{value}</p>
    </div>
  );
}
