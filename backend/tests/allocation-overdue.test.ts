import { AllocationStatus } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  allocationUpdateMany: vi.fn(),
}));

vi.mock("../src/config/prisma", () => ({
  prisma: {
    allocation: {
      updateMany: mocks.allocationUpdateMany,
    },
  },
}));

import { markOverdueAllocations } from "../src/modules/allocations/allocations.service";

describe("markOverdueAllocations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks active past-due allocations as OVERDUE", async () => {
    mocks.allocationUpdateMany.mockResolvedValue({ count: 3 });

    await expect(markOverdueAllocations()).resolves.toEqual({ updated: 3 });

    expect(mocks.allocationUpdateMany).toHaveBeenCalledWith({
      where: {
        status: AllocationStatus.ACTIVE,
        expectedReturnDate: { lt: expect.any(Date) },
      },
      data: { status: AllocationStatus.OVERDUE },
    });
  });
});
