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
  { label: "Dashboard", href: "/", icon: Gauge },
  { label: "Assets", href: "/assets", icon: Boxes },
  { label: "Allocations", href: "/allocations", icon: ArrowRightLeft },
  { label: "Transfers", href: "/transfers", icon: ArrowLeftRight },
  { label: "Bookings", href: "/bookings", icon: BookOpen },
  { label: "Maintenance", href: "/maintenance", icon: Wrench },
  { label: "Audits", href: "/audits", icon: ClipboardCheck },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "Activity logs", href: "/activity-logs", icon: History, roles: ["ADMIN"] },
  { label: "Org Setup", href: "/org-setup", icon: Settings2, roles: ["ADMIN"] },
];

export function getNavigationForRole(role: Role) {
  return navigationItems.filter(
    (item) => !item.roles || item.roles.includes(role),
  );
}
