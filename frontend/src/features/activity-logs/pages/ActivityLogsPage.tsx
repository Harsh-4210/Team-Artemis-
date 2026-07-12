import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { PageHeader } from "../../../components/shared/PageHeader";
import { EmptyState, ErrorState, PageSkeleton } from "../../../components/shared/Feedback";
import { apiClient } from "../../../lib/apiClient";
import { getErrorMessage } from "../../../lib/utils";

type Log = { id: string; action: string; entityType: string; entityId: string; details: unknown; createdAt: string; employee: { name: string; email: string; role: string } };
export function ActivityLogsPage() {
 const [entityType, setEntityType] = useState("");
 const query = useQuery({ queryKey: ["activity-logs", entityType], queryFn: async () => { const { data } = await apiClient.get("/activity-logs", { params: entityType ? { entityType } : {} }); return (data.data ?? data) as Log[]; } });
 if (query.isLoading) return <PageSkeleton />; if (query.isError) return <ErrorState message={getErrorMessage(query.error, "Activity logs could not be loaded.")} onRetry={() => void query.refetch()} />;
 return <div className="space-y-6"><PageHeader title="Activity logs" description="A trace of operational changes across AssetFlow." /><div className="flex gap-3"><input value={entityType} onChange={(event) => setEntityType(event.target.value)} placeholder="Filter by entity type, e.g. AUDIT" className="h-10 w-full max-w-sm rounded-lg border border-[var(--border)] px-3 text-sm" /></div><div className="overflow-x-auto rounded-xl border border-[var(--border)]">{query.data?.length ? <table className="w-full text-left text-sm"><thead className="bg-[var(--surface)] text-xs uppercase text-[var(--muted)]"><tr><th className="p-3">When</th><th className="p-3">Who</th><th className="p-3">Action</th><th className="p-3">Entity</th></tr></thead><tbody>{query.data.map((log) => <tr key={log.id} className="border-t border-[var(--border)]"><td className="p-3 text-[var(--muted)]">{new Date(log.createdAt).toLocaleString()}</td><td className="p-3"><p className="font-medium">{log.employee.name}</p><p className="text-xs text-[var(--muted)]">{log.employee.email}</p></td><td className="p-3">{log.action}</td><td className="p-3 text-[var(--muted)]">{log.entityType}</td></tr>)}</tbody></table> : <EmptyState title="No activity found" description="Actions will appear here as your organization uses AssetFlow." />}</div></div>;
}
