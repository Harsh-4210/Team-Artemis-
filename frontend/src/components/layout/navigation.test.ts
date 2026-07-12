import { describe, expect, it } from "vitest";
import { getNavigationForRole } from "./navigation";

describe("role-aware navigation", () => {
  it("shows organization setup only to admins", () => {
    expect(getNavigationForRole("ADMIN").map((item) => item.label)).toContain(
      "Org Setup",
    );
    for (const role of [
      "EMPLOYEE",
      "DEPARTMENT_HEAD",
      "ASSET_MANAGER",
    ] as const) {
      expect(
        getNavigationForRole(role).map((item) => item.label),
      ).not.toContain("Org Setup");
    }
  });

  it("keeps core operational routes visible to every role", () => {
    expect(getNavigationForRole("EMPLOYEE").map((item) => item.label)).toEqual([
      "Dashboard",
      "Assets",
      "Allocations",
      "Transfers",
      "Bookings",
      "Maintenance",
      "Audits",
      "Reports",
    ]);
  });
});
