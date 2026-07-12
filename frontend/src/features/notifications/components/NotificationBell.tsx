import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "../../../components/ui/Button";
import { getErrorMessage } from "../../../lib/utils";
import { notificationsApi } from "../api";

export function NotificationBell() {
  const [open, setOpen] = useState(false); const client = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: notificationsApi.list, refetchInterval: 15_000 });
  const refresh = () => client.invalidateQueries({ queryKey: ["notifications"] });
  const read = useMutation({ mutationFn: notificationsApi.markRead, onSuccess: refresh });
  const all = useMutation({ mutationFn: notificationsApi.markAllRead, onSuccess: refresh });
  const data = query.data; const items = data?.notifications ?? [];
  return <div className="relative">
    <button type="button" aria-label="Notifications" onClick={() => setOpen((value) => !value)} className="relative grid size-10 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"><Bell className="size-5" />{data?.unreadCount ? <span className="absolute right-1 top-1 grid min-w-4 place-items-center rounded-full bg-[var(--danger)] px-1 text-[10px] font-bold text-white">{data.unreadCount > 9 ? "9+" : data.unreadCount}</span> : null}</button>
    {open ? <div className="absolute right-0 z-50 mt-2 w-[360px] overflow-hidden rounded-xl border border-[var(--border)] bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3"><p className="font-semibold text-[var(--ink)]">Notifications</p><Button variant="ghost" className="h-8 px-2 text-xs" disabled={!data?.unreadCount || all.isPending} onClick={() => all.mutate()}> <CheckCheck className="size-4" />Mark all read</Button></div>
      <div className="max-h-96 overflow-y-auto">{query.isError ? <p className="p-4 text-sm text-[var(--danger)]">{getErrorMessage(query.error, "Notifications could not be loaded.")}</p> : items.length ? items.map((item) => <button key={item.id} type="button" onClick={() => { if (!item.isRead) read.mutate(item.id); }} className={`block w-full border-b border-[var(--border)] px-4 py-3 text-left hover:bg-[var(--surface)] ${item.isRead ? "" : "bg-[var(--primary-soft)]"}`}><p className="text-sm font-medium text-[var(--ink)]">{item.title}</p><p className="mt-0.5 text-xs leading-5 text-[var(--muted)]">{item.message}</p><p className="mt-1 text-[11px] text-[var(--muted)]">{new Date(item.createdAt).toLocaleString()}</p></button>) : <p className="p-6 text-center text-sm text-[var(--muted)]">You are all caught up.</p>}</div>
    </div> : null}
  </div>;
}
