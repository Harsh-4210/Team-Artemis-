import type { ReactNode } from "react";
import { Navigate } from "react-router";
import type { Role } from "../features/auth/types";
import { useAuthStore } from "../stores/authStore";

export function RoleGate({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const role = useAuthStore((state) => state.user?.role);
  if (!role || !roles.includes(role)) return <Navigate to="/app" replace />;
  return children;
}
