import { LogOut, X } from "lucide-react";
import { NavLink, useNavigate } from "react-router";
import { useEffect } from "react";
import { cn, initials } from "../../lib/utils";
import { useAuthStore } from "../../stores/authStore";
import { Brand } from "../../features/auth/pages/AuthShell";
import { Button } from "../ui/Button";
import { getNavigationForRole } from "./navigation";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);
  const items = getNavigationForRole(user?.role ?? "EMPLOYEE");

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        className={cn("fixed inset-0 z-30 bg-[color-mix(in_oklch,var(--ink)_35%,transparent)] transition-opacity duration-200 lg:hidden", open ? "opacity-100" : "pointer-events-none opacity-0")}
        onClick={onClose}
      />
      <aside
        id="app-sidebar"
        aria-label="Primary navigation"
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-transform duration-200 lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-20 items-center justify-between px-5">
          <Brand />
          <button type="button" aria-label="Close navigation" onClick={onClose} className="grid size-11 place-items-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface-strong)] lg:hidden">
            <X aria-hidden="true" className="size-5" strokeWidth={1.75} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-1">
            {items.map(({ href, label, icon: Icon }) => (
              <li key={href}>
                <NavLink
                  to={href}
                  end={href === "/app"}
                  onClick={onClose}
                  className={({ isActive }) => cn(
                    "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium text-[var(--muted)] transition-colors duration-200 hover:bg-[var(--surface-strong)] hover:text-[var(--ink)]",
                    isActive && "bg-[var(--primary-soft)] text-[var(--ink)]",
                  )}
                >
                  {({ isActive }) => <><Icon aria-hidden="true" className={cn("size-[18px]", isActive && "text-[var(--primary)]")} strokeWidth={1.75} /><span>{label}</span></>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="border-t border-[var(--border)] p-3">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[var(--primary-soft)] text-xs font-semibold text-[var(--primary)]">{initials(user?.name)}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-[var(--ink)]">{user?.name}</p>
              <p className="truncate text-xs text-[var(--muted)]">{user?.email}</p>
            </div>
          </div>
          <Button variant="ghost" className="mt-1 w-full justify-start" onClick={logout}><LogOut aria-hidden="true" className="size-[18px]" strokeWidth={1.75} />Sign out</Button>
        </div>
      </aside>
    </>
  );
}
