import { AlertTriangle, ArrowRight, Boxes, CalendarClock, Settings2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { PageHeader } from "../../../components/shared/PageHeader";
import { Badge } from "../../../components/ui/Badge";
import { useAuthStore } from "../../../stores/authStore";
import { ErrorState, PageSkeleton } from "../../../components/shared/Feedback";
import { getErrorMessage } from "../../../lib/utils";
import { reportsApi } from "../../reports/api";

const quickLinks = [
  { title: "Browse assets", description: "Find equipment and see current availability.", href: "/assets", icon: Boxes },
  { title: "View bookings", description: "Review shared resources and upcoming reservations.", href: "/bookings", icon: CalendarClock },
];

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const roleLabel = user?.role.replaceAll("_", " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  const kpis = useQuery({ queryKey: ["dashboard-kpis"], queryFn: reportsApi.kpis, refetchInterval: 30_000 });
  if (kpis.isLoading) return <PageSkeleton />;
  if (kpis.isError) return <ErrorState message={getErrorMessage(kpis.error, "Dashboard data could not be loaded.")} onRetry={() => void kpis.refetch()} />;
  const data = kpis.data;
  if (!data) return <ErrorState message="Dashboard data is unavailable." onRetry={() => void kpis.refetch()} />;
  const cards = [{ label: "Assets available", value: data.assetsAvailable }, { label: "Assets allocated", value: data.assetsAllocated }, { label: "Maintenance today", value: data.maintenanceToday }, { label: "Active bookings", value: data.activeBookings }, { label: "Pending transfers", value: data.pendingTransfers }, { label: "Upcoming returns", value: data.upcomingReturns }];
  return (
    <div className="space-y-8">
      <PageHeader title={`Good to see you, ${user?.name.split(" ")[0] ?? "there"}`} description="Your starting point for current assets, reservations, and organization work." />
      <section aria-labelledby="account-context-heading">
        <h2 id="account-context-heading" className="text-xl font-semibold text-[var(--ink)]">Account context</h2>
        <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
          <div><p className="text-xs text-[var(--muted)]">Access level</p><div className="mt-1"><Badge tone={user?.role === "ADMIN" ? "danger" : "neutral"}>{roleLabel}</Badge></div></div>
          <div><p className="text-xs text-[var(--muted)]">Department</p><p className="mt-1 text-sm font-medium text-[var(--ink)]">{user?.department?.name ?? "Not assigned"}</p></div>
          <div><p className="text-xs text-[var(--muted)]">Signed in as</p><p className="mt-1 text-sm font-medium text-[var(--ink)]">{user?.email}</p></div>
        </div>
      </section>
      <section aria-label="Today’s overview"><div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold text-[var(--ink)]">Today’s overview</h2><span className="text-xs text-[var(--muted)]">Refreshes every 30 seconds</span></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards.map((card) => <div key={card.label} className="rounded-xl border border-[var(--border)] bg-white p-5"><p className="text-sm text-[var(--muted)]">{card.label}</p><p className="mt-2 text-3xl font-semibold text-[var(--ink)]">{card.value}</p></div>)}<div className="rounded-xl border border-[var(--danger)] bg-[var(--danger-soft)] p-5"><div className="flex items-center gap-2 text-[var(--danger)]"><AlertTriangle className="size-4" /><p className="text-sm font-medium">Overdue returns</p></div><p className="mt-2 text-3xl font-semibold text-[var(--danger)]">{data.overdueReturns}</p><p className="mt-1 text-xs text-[var(--danger)]">Needs follow-up</p></div></div></section>
      <section aria-labelledby="quick-actions-heading">
        <h2 id="quick-actions-heading" className="text-xl font-semibold text-[var(--ink)]">Start here</h2>
        <div className="mt-4 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {[...quickLinks, ...(user?.role === "ADMIN" ? [{ title: "Set up your organization", description: "Manage departments, categories, employees, and roles.", href: "/org-setup", icon: Settings2 }] : [])].map(({ title, description, href, icon: Icon }) => (
            <Link key={href} to={href} className="group flex min-h-20 items-center gap-4 px-5 py-4 transition-colors duration-200 hover:bg-[var(--surface)] first:rounded-t-xl last:rounded-b-xl">
              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"><Icon aria-hidden="true" className="size-5" strokeWidth={1.75} /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-[var(--ink)]">{title}</span><span className="mt-0.5 block text-sm text-[var(--muted)]">{description}</span></span>
              <ArrowRight aria-hidden="true" className="size-[18px] shrink-0 text-[var(--muted)] transition-transform duration-200 group-hover:translate-x-0.5" strokeWidth={1.75} />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
