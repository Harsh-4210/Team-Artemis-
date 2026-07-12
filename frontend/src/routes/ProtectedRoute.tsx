import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router";
import { authApi } from "../features/auth/api";
import type { Role } from "../features/auth/types";
import { useAuthStore } from "../stores/authStore";

function RouteLoading() {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-[var(--surface)] px-5" role="status" aria-label="Restoring your session">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-[var(--border)] bg-white p-6">
        <div className="h-8 w-36 animate-pulse rounded-lg bg-[var(--surface-strong)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[var(--surface)]" />
        <div className="h-11 w-full animate-pulse rounded-lg bg-[var(--surface-strong)]" />
      </div>
    </div>
  );
}

export function ProtectedRoute({ children, roles: allowedRoles }: { children: ReactNode; roles?: Role[] }) {
  const location = useLocation();
  const token = useAuthStore((state) => state.token);
  const user = useAuthStore((state) => state.user);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const updateUser = useAuthStore((state) => state.updateUser);
  const clearSession = useAuthStore((state) => state.clearSession);
  const [checking, setChecking] = useState(Boolean(token));
  const [verifiedToken, setVerifiedToken] = useState<string | null>(null);

  useEffect(() => {
    if (!hasHydrated || !token || verifiedToken === token) {
      if (hasHydrated && !token) setChecking(false);
      return;
    }
    let active = true;
    setChecking(true);
    authApi.me()
      .then((currentUser) => {
        if (!active) return;
        updateUser(currentUser);
        setVerifiedToken(token);
      })
      .catch(() => {
        if (active) clearSession();
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => { active = false; };
  }, [clearSession, hasHydrated, token, updateUser, verifiedToken]);

  if (!hasHydrated || checking) return <RouteLoading />;
  if (!token || !user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/app" replace />;
  return children;
}
