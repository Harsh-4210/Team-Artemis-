import { apiClient } from "../../lib/apiClient";

import type { AssetCondition, AssetListItem } from "../assets/api";

export type AllocationStatus = "ACTIVE" | "RETURNED" | "OVERDUE";

export type Allocation = {
  id: string;
  assetId: string;
  employeeId: string;
  allocatedAt: string;
  expectedReturnDate: string | null;
  returnedAt: string | null;
  conditionOnReturn: AssetCondition | null;
  notes: string | null;
  status: AllocationStatus;
  allocatedById: string;
  createdAt: string;
  isOverdue?: boolean;
  asset: Pick<
    AssetListItem,
    "id" | "assetTag" | "name" | "location" | "status" | "category"
  >;
  employee: {
    id: string;
    name: string;
    email: string;
    department: { id: string; name: string; code: string } | null;
  };
  allocatedBy: { id: string; name: string; email: string };
};

export type AllocationListResponse = {
  items: Allocation[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AllocationFilter = {
  status?: AllocationStatus;
  scope?: "mine" | "all";
  employeeId?: string;
  assetId?: string;
  page?: number;
  limit?: number;
};

export type AllocationPayload = {
  assetId: string;
  employeeId: string;
  expectedReturnDate?: string;
  notes?: string;
};

export type AllocationConflictDetails = {
  assetId: string | null;
  allocationId: string | null;
  currentHolderId: string | null;
  currentHolder: string | null;
};

export type TransferPayload = {
  assetId: string;
  fromEmployeeId: string;
  toEmployeeId: string;
  reason: string;
};

export const allocationsApi = {
  async listAllocations(filters: AllocationFilter = {}) {
    const { data } = await apiClient.get("/allocations", { params: filters });
    return (data?.data ?? data) as AllocationListResponse;
  },
  async listOverdueAllocations() {
    const { data } = await apiClient.get("/allocations/overdue");
    return (data?.data ?? data) as AllocationListResponse;
  },
  createAllocation(payload: AllocationPayload) {
    return apiClient.post("/allocations", payload);
  },
  returnAllocation(
    id: string,
    payload: { conditionOnReturn?: AssetCondition; notes?: string },
  ) {
    return apiClient.post(`/allocations/${id}/return`, payload);
  },
  requestTransfer(payload: TransferPayload) {
    return apiClient.post("/transfers", payload);
  },
  approveTransfer(id: string, payload: { notes?: string } = {}) {
    return apiClient.post(`/transfers/${id}/approve`, payload);
  },
  rejectTransfer(id: string, reason: string) {
    return apiClient.post(`/transfers/${id}/reject`, { reason });
  },
};

export const allocationsQueryKeys = {
  all: ["allocations"] as const,
  list: (filters: AllocationFilter) =>
    ["allocations", "list", filters] as const,
  overdue: ["allocations", "overdue"] as const,
};
