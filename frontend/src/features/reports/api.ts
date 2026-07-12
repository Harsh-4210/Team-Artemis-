import { apiClient } from "../../lib/apiClient";
export type Kpis = { assetsAvailable: number; assetsAllocated: number; maintenanceToday: number; activeBookings: number; pendingTransfers: number; upcomingReturns: number; overdueReturns: number };
export const reportsApi = {
  async kpis() { const { data } = await apiClient.get("/reports/dashboard-kpis"); return (data.data ?? data) as Kpis; },
  async utilization() { const { data } = await apiClient.get("/reports/utilization"); return (data.data ?? data) as Array<{ id: string; assetTag: string; name: string; status: string; allocationDays: number; allocationCount: number; idle: boolean }>; },
  async maintenance() { const { data } = await apiClient.get("/reports/maintenance-frequency"); return (data.data ?? data) as Array<{ assetId: string; assetName: string; category: string; requestCount: number }>; },
  async department() { const { data } = await apiClient.get("/reports/department-allocation"); return (data.data ?? data) as Array<{ departmentId: string; department: string; allocatedAssets: number; employees: number }>; },
  async heatmap() { const { data } = await apiClient.get("/reports/booking-heatmap"); return (data.data ?? data) as Array<{ day: number; hour: number; count: number }>; },
  exportUrl(type: "utilization" | "maintenance" | "department" | "heatmap") { return `${apiClient.defaults.baseURL}/reports/export?type=${type}&format=csv`; },
};
