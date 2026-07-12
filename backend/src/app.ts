import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";
import { authRouter } from "./modules/auth/auth.routes";
import { allocationsRouter } from "./modules/allocations/allocations.routes";
import { assetsRouter } from "./modules/assets/assets.routes";
import { bookingsRouter } from "./modules/bookings/bookings.routes";
import { categoriesRouter } from "./modules/categories/categories.routes";
import { departmentsRouter } from "./modules/departments/departments.routes";
import { employeesRouter } from "./modules/employees/employees.routes";
import { maintenanceRouter } from "./modules/maintenance/maintenance.routes";
import { transfersRouter } from "./modules/transfers/transfers.routes";

export const app = express();

app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    credentials: true,
    origin: env.corsOrigins
      ? (origin, callback) => {
          if (!origin || env.corsOrigins?.includes(origin)) {
            callback(null, true);
            return;
          }
          callback(null, false);
        }
      : true,
  }),
);
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));

if (env.NODE_ENV !== "test") {
  app.use(morgan(env.NODE_ENV === "production" ? "combined" : "dev"));
}

const health = (_request: express.Request, response: express.Response) => {
  response.json({
    data: {
      status: "ok",
      service: "assetflow-api",
      timestamp: new Date().toISOString(),
    },
  });
};

app.get("/health", health);
app.get("/api/v1/health", health);
app.use("/api/v1/auth", authRouter);
app.use("/api/v1/allocations", allocationsRouter);
app.use("/api/v1/assets", assetsRouter);
app.use("/api/v1/departments", departmentsRouter);
app.use("/api/v1/categories", categoriesRouter);
app.use("/api/v1/employees", employeesRouter);
app.use("/api/v1/bookings", bookingsRouter);
app.use("/api/v1/maintenance", maintenanceRouter);
app.use("/api/v1/transfers", transfersRouter);

app.use(notFoundHandler);
app.use(errorHandler);
