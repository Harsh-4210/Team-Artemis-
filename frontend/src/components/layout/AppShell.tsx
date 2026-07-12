import { Menu } from "lucide-react";
import { useState } from "react";
import { Outlet, useLocation } from "react-router";
import { Sidebar } from "./Sidebar";
import { navigationItems } from "./navigation";
import { NotificationBell } from "../../features/notifications/components/NotificationBell";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const sectionName = navigationItems.find((item) => item.href === "/" ? location.pathname === "/" : location.pathname.startsWith(item.href))?.label ?? "AssetFlow";

  return (
    <div className="min-h-[100dvh] bg-white">
      <a href="#main-content" className="fixed left-4 top-3 z-[60] -translate-y-20 rounded-lg bg-[var(--ink)] px-4 py-2 text-sm font-medium text-white focus:translate-y-0">Skip to content</a>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-[var(--border)] bg-white px-5">
          <button type="button" aria-label="Open navigation" aria-controls="app-sidebar" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen(true)} className="grid size-11 place-items-center rounded-lg text-[var(--ink)] hover:bg-[var(--surface)]">
            <Menu aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
          <p className="text-sm font-semibold text-[var(--ink)]">{sectionName}</p>
          <div className="ml-auto"><NotificationBell /></div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-[1440px] px-5 py-7 sm:px-7 sm:py-8 lg:px-9 lg:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
