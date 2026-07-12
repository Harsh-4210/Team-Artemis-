import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, RefreshCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { EmptyState, ErrorState, PageSkeleton } from "../../../components/shared/Feedback";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { cn, getErrorMessage } from "../../../lib/utils";
import { useAuthStore } from "../../../stores/authStore";
import { orgApi, orgQueryKeys } from "../../org-setup/api";
import { auditsApi, auditsQueryKeys, type AuditCycleStatus, type CreateAuditCyclePayload } from "../api";
import { CreateCycleDialog } from "../components/CreateCycleDialog";
import { cycleStatusLabel, cycleStatusTone, describeScope, formatDate } from "../utils";

type StatusFilter = "ALL" | AuditCycleStatus;

const STATUS_FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "ALL", label: "All" },
  { value: "DRAFT", label: "Draft" },
  { value: "ACTIVE", label: "Active" },
  { value: "CLOSED", label: "Closed" },
];

export function AuditsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === "ADMIN";

  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [createOpen, setCreateOpen] = useState(false);

  // Real server-side filtering: the backend's list endpoint accepts a `status` query param
  // directly (see listAuditCyclesQuerySchema), so this is not a client-side-only filter.
  const cyclesQuery = useQuery({
    queryKey: auditsQueryKeys.list({ status: statusFilter === "ALL" ? undefined : statusFilter }),
    queryFn: () => auditsApi.listCycles({ status: statusFilter === "ALL" ? undefined : statusFilter }),
  });

  const departmentsQuery = useQuery({
    queryKey: orgQueryKeys.departments,
    queryFn: orgApi.listDepartments,
    enabled: isAdmin,
  });
  const employeesQuery = useQuery({
    queryKey: [...orgQueryKeys.employees, "active"],
    queryFn: () => orgApi.listEmployees({ status: "ACTIVE" }),
    enabled: isAdmin,
  });

  const createMutation = useMutation({
    mutationFn: async ({ payload, auditorIds }: { payload: CreateAuditCyclePayload; auditorIds: string[] }) => {
      const cycle = await auditsApi.createCycle(payload);
      if (auditorIds.length === 0) {
        return { cycle, assignFailed: false as const };
      }
      try {
        await auditsApi.assignAuditors(cycle.id, auditorIds);
        return { cycle, assignFailed: false as const };
      } catch (assignError) {
        // The cycle itself was created successfully — never hide that. Surface the assignment
        // failure separately and let the admin finish assignment from the detail page.
        return { cycle, assignFailed: true as const, assignError };
      }
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: auditsQueryKeys.all });
      setCreateOpen(false);
      if (result.assignFailed) {
        toast.error(getErrorMessage(result.assignError, "Cycle was created, but auditors could not be assigned."), {
          description: "Open the cycle to assign auditors again.",
        });
      } else {
        toast.success("Audit cycle created");
      }
      navigate(`/audits/${result.cycle.id}`);
    },
    onError: (error) => {
      toast.error(getErrorMessage(error, "Audit cycle could not be created."));
    },
  });

  const cycles = cyclesQuery.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audits"
        description="Run physical asset-verification cycles by department, location, or the whole organization."
        actions={
          <>
            <Button variant="secondary" onClick={() => void cyclesQuery.refetch()}>
              <RefreshCcw aria-hidden="true" className="size-4" strokeWidth={1.75} />
              Refresh
            </Button>
            {isAdmin ? (
              <Button onClick={() => setCreateOpen(true)}>
                <ClipboardCheck aria-hidden="true" className="size-4" strokeWidth={1.75} />
                Create audit cycle
              </Button>
            ) : null}
          </>
        }
      />

      <div className="flex flex-wrap gap-1.5">
        {STATUS_FILTERS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setStatusFilter(option.value)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
              statusFilter === option.value
                ? "border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]"
                : "border-[var(--border)] bg-white text-[var(--muted)] hover:text-[var(--ink)]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>

      {cyclesQuery.isLoading ? (
        <PageSkeleton />
      ) : cyclesQuery.isError ? (
        <ErrorState
          message={getErrorMessage(cyclesQuery.error, "Audit cycles could not be loaded.")}
          onRetry={() => void cyclesQuery.refetch()}
        />
      ) : cycles.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)]">
          <EmptyState
            title="No audit cycles yet"
            description={
              isAdmin
                ? "Create a cycle to start verifying assets by department, location, or org-wide."
                : "You'll see cycles here once an admin assigns you as an auditor."
            }
            icon={ShieldCheck}
            action={isAdmin ? <Button onClick={() => setCreateOpen(true)}>Create audit cycle</Button> : undefined}
          />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full min-w-[900px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[var(--surface)] text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                <th className="px-4 py-3">Cycle</th>
                <th className="px-4 py-3">Scope</th>
                <th className="px-4 py-3">Dates</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Created by</th>
                <th className="px-4 py-3">Auditors</th>
                <th className="px-4 py-3 text-right">Records</th>
              </tr>
            </thead>
            <tbody>
              {cycles.map((cycle) => (
                <tr
                  key={cycle.id}
                  className="cursor-pointer border-t border-[var(--border)] hover:bg-[var(--surface)]"
                  onClick={() => navigate(`/audits/${cycle.id}`)}
                >
                  <td className="px-4 py-3 font-medium text-[var(--ink)]">{cycle.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{describeScope(cycle)}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">
                    {formatDate(cycle.startDate)} – {formatDate(cycle.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={cycleStatusTone[cycle.status]}>{cycleStatusLabel[cycle.status]}</Badge>
                  </td>
                  <td className="px-4 py-3 text-[var(--muted)]">{cycle.createdBy.name}</td>
                  <td className="px-4 py-3 text-[var(--muted)]">{cycle.assignments.length}</td>
                  <td className="px-4 py-3 text-right text-[var(--muted)]">{cycle._count.records}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isAdmin ? (
        <CreateCycleDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          departments={departmentsQuery.data ?? []}
          employees={employeesQuery.data ?? []}
          submitting={createMutation.isPending}
          onSubmit={(values) => createMutation.mutateAsync(values)}
        />
      ) : null}
    </div>
  );
}
