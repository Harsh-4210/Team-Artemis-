import { BarChart3 } from "lucide-react";
import { Navigate, RouterProvider, createBrowserRouter } from "react-router";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./features/auth/pages/LoginPage";
import { SignupPage } from "./features/auth/pages/SignupPage";
import { AssetDetailPage } from "./features/assets/pages/AssetDetailPage";
import { AssetsPage } from "./features/assets/pages/AssetsPage";
import { AllocationCreatePage } from "./features/allocations/pages/AllocationCreatePage";
import { AllocationsPage } from "./features/allocations/pages/AllocationsPage";
import { TransfersPage } from "./features/allocations/pages/TransfersPage";
import { AuditDetailPage } from "./features/audits/pages/AuditDetailPage";
import { AuditsPage } from "./features/audits/pages/AuditsPage";
import { BookingsPage } from "./features/bookings/pages/BookingsPage";
import { DashboardPage } from "./features/dashboard/pages/DashboardPage";
import { MaintenancePage } from "./features/maintenance/pages/MaintenancePage";
import { ReportsPage } from "./features/reports/pages/ReportsPage";
import { ActivityLogsPage } from "./features/activity-logs/pages/ActivityLogsPage";
import { CategoriesPage } from "./features/org-setup/pages/CategoriesPage";
import { DepartmentsPage } from "./features/org-setup/pages/DepartmentsPage";
import { EmployeesPage } from "./features/org-setup/pages/EmployeesPage";
import { OrgSetupLayout } from "./features/org-setup/pages/OrgSetupLayout";
import { ModulePlaceholderPage } from "./features/shared/pages/ModulePlaceholderPage";
import { NotFoundPage } from "./features/shared/pages/NotFoundPage";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { PublicOnlyRoute } from "./routes/PublicOnlyRoute";
import { RoleGate } from "./routes/RoleGate";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: (
      <PublicOnlyRoute>
        <LoginPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/signup",
    element: (
      <PublicOnlyRoute>
        <SignupPage />
      </PublicOnlyRoute>
    ),
  },
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <AppShell />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "assets", element: <AssetsPage /> },
      { path: "assets/:id", element: <AssetDetailPage /> },
      { path: "allocations", element: <AllocationsPage /> },
      { path: "allocations/new", element: <AllocationCreatePage /> },
      { path: "transfers", element: <TransfersPage /> },
      { path: "bookings", element: <BookingsPage /> },
      { path: "maintenance", element: <MaintenancePage /> },
      { path: "audits", element: <AuditsPage /> },
      { path: "audits/:id", element: <AuditDetailPage /> },
      { path: "reports", element: <ReportsPage /> },
      { path: "activity-logs", element: <RoleGate roles={["ADMIN"]}><ActivityLogsPage /></RoleGate> },
      {
        path: "org-setup",
        element: (
          <RoleGate roles={["ADMIN"]}>
            <OrgSetupLayout />
          </RoleGate>
        ),
        children: [
          { index: true, element: <Navigate to="departments" replace /> },
          { path: "departments", element: <DepartmentsPage /> },
          { path: "categories", element: <CategoriesPage /> },
          { path: "employees", element: <EmployeesPage /> },
        ],
      },
    ],
  },
  { path: "*", element: <NotFoundPage /> },
]);

export function App() {
  return <RouterProvider router={router} />;
}
