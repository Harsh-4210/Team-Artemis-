import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuthStore } from "../stores/authStore";

export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { token, user, hasHydrated } = useAuthStore();
  if (!hasHydrated) return null;
  if (token && user) return <Navigate to="/app" replace />;
  return children;
}
