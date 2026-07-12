import {
  ArrowLeftRight,
  ArrowRightLeft,
  BarChart3,
  BookOpen,
  Boxes,
  ClipboardCheck,
  Gauge,
  History,
  Settings2,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "../../features/auth/types";

export type NavigationItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  roles?: Role[];
};

export const navigationItems: NavigationItem[] = [
  { label: "Dashboard", href: "/app", icon: Gauge },
  { label: "Assets", href: "/app/assets", icon: Boxes },
  { label: "Allocations", href: "/app/allocations", icon: ArrowRightLeft },
  { label: "Transfers", href: "/app/transfers", icon: ArrowLeftRight },
  { label: "Bookings", href: "/app/bookings", icon: BookOpen },
  { label: "Maintenance", href: "/app/maintenance", icon: Wrench },
  { label: "Audits", href: "/app/audits", icon: ClipboardCheck },
  { label: "Reports", href: "/app/reports", icon: BarChart3 },
  { label: "Activity logs", href: "/app/activity-logs", icon: History, roles: ["ADMIN"] },
  { label: "Org Setup", href: "/app/org-setup", icon: Settings2, roles: ["ADMIN"] },
];

export function getNavigationForRole(role: Role) {
  return navigationItems.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
}
