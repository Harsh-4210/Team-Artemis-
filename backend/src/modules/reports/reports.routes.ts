import { Router } from "express";
import { authenticateToken } from "../../middleware/auth";
import { asyncHandler } from "../../utils/async-handler";
import { dashboardKpis, departmentAllocation, exportReport, bookingHeatmap, maintenanceFrequency, utilization } from "./reports.service";

export const reportsRouter = Router();
reportsRouter.use(authenticateToken);
reportsRouter.get("/dashboard-kpis", asyncHandler(async (_request, response) => response.json({ data: await dashboardKpis() })));
reportsRouter.get("/utilization", asyncHandler(async (_request, response) => response.json({ data: await utilization() })));
reportsRouter.get("/maintenance-frequency", asyncHandler(async (_request, response) => response.json({ data: await maintenanceFrequency() })));
reportsRouter.get("/department-allocation", asyncHandler(async (_request, response) => response.json({ data: await departmentAllocation() })));
reportsRouter.get("/booking-heatmap", asyncHandler(async (_request, response) => response.json({ data: await bookingHeatmap() })));
reportsRouter.get("/export", asyncHandler(async (request, response) => {
  const type = String(request.query.type ?? "");
  const csv = await exportReport(type);
  response.setHeader("Content-Type", "text/csv; charset=utf-8");
  response.setHeader("Content-Disposition", `attachment; filename="assetflow-${type}-report.csv"`);
  response.send(csv);
}));
