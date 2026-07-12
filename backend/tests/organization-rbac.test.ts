import type { Role } from "@prisma/client";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
  },
}));

import { app } from "../src/app";
import { signAccessToken } from "../src/middleware/auth";

const principal = {
  userId: "11111111-1111-4111-8111-111111111111",
  employeeId: "22222222-2222-4222-8222-222222222222",
  email: "employee@example.com",
  // Deliberately stale: authorization must use the current database role.
  role: "ADMIN" as Role,
};

describe("organization route authorization", () => {
  beforeEach(() => {
    mocks.userFindUnique.mockReset();
    mocks.userFindUnique.mockResolvedValue({
      id: principal.userId,
      email: principal.email,
      employee: {
        id: principal.employeeId,
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    });
  });

  it.each([
    ["post", "/api/v1/departments"],
    ["patch", "/api/v1/departments/33333333-3333-4333-8333-333333333333"],
    ["delete", "/api/v1/departments/33333333-3333-4333-8333-333333333333"],
    ["post", "/api/v1/categories"],
    ["patch", "/api/v1/categories/33333333-3333-4333-8333-333333333333"],
    ["delete", "/api/v1/categories/33333333-3333-4333-8333-333333333333"],
    ["get", "/api/v1/employees"],
    ["patch", "/api/v1/employees/33333333-3333-4333-8333-333333333333/promote"],
    ["patch", "/api/v1/employees/33333333-3333-4333-8333-333333333333/status"],
  ] as const)("returns 403 for a non-admin: %s %s", async (method, path) => {
    const response = await request(app)
      [method](path)
      .set("Authorization", `Bearer ${signAccessToken(principal)}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatchObject({ code: "FORBIDDEN" });
  });

  it("allows authenticated employees to list departments and categories", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: principal.userId,
      email: principal.email,
      employee: {
        id: principal.employeeId,
        role: "EMPLOYEE",
        status: "ACTIVE",
      },
    });

    // These routes still hit the DB after auth; without a full prisma mock
    // they may 500 — assert they are not blocked by RBAC (not 403).
    for (const path of ["/api/v1/departments", "/api/v1/categories"]) {
      const response = await request(app)
        .get(path)
        .set("Authorization", `Bearer ${signAccessToken(principal)}`);
      expect(response.status).not.toBe(403);
      expect(response.status).not.toBe(401);
    }
  });
});
