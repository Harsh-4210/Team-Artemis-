import { apiClient } from "../../lib/apiClient";

export type AssetStatus =
  | "AVAILABLE"
  | "ALLOCATED"
  | "RESERVED"
  | "UNDER_MAINTENANCE"
  | "LOST"
  | "RETIRED"
  | "DISPOSED";

export type AssetCondition = "NEW" | "GOOD" | "FAIR" | "POOR";

export type AssetCategory = {
  id: string;
  name: string;
  description?: string | null;
};

export type AssetListItem = {
  id: string;
  assetTag: string;
  name: string;
  serialNumber: string | null;
  acquisitionDate: string;
  acquisitionCost: string;
  condition: AssetCondition;
  location: string;
  photoUrl: string | null;
  isBookable: boolean;
  status: AssetStatus;
  customData?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
  category: AssetCategory | null;
  currentAllocation: {
    id: string;
    employee: {
      id: string;
      name: string;
      email: string;
      department: { id: string; name: string; code: string } | null;
    };
    allocatedAt: string;
    expectedReturnDate: string | null;
  } | null;
  currentHolder: {
    id: string;
    name: string;
    email: string;
    department: { id: string; name: string; code: string } | null;
  } | null;
};

export type AssetDetail = AssetListItem & {
  allocations: Array<{
    id: string;
    assetId: string;
    employeeId: string;
    allocatedAt: string;
    expectedReturnDate: string | null;
    returnedAt: string | null;
    conditionOnReturn: AssetCondition | null;
    notes: string | null;
    status: "ACTIVE" | "RETURNED" | "OVERDUE";
    allocatedById: string;
    createdAt: string;
    employee: {
      id: string;
      name: string;
      email: string;
      department: { id: string; name: string; code: string } | null;
    };
    allocatedBy: { id: string; name: string; email: string };
  }>;
  maintenanceRequests: Array<{
    id: string;
    description: string;
    status: string;
    priority: string;
    createdAt: string;
    raisedBy: { id: string; name: string; email: string };
  }>;
  transferRequests: Array<{
    id: string;
    reason: string;
    status: string;
    requestedAt: string;
    fromEmployee: { id: string; name: string; email: string };
    toEmployee: { id: string; name: string; email: string };
  }>;
};

export type AssetListFilters = {
  search?: string;
  status?: AssetStatus;
  categoryId?: string;
  departmentId?: string;
  location?: string;
  page?: number;
  limit?: number;
};

export type AssetListResponse = {
  items: AssetListItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

export type AssetPayload = {
  name: string;
  categoryId: string;
  serialNumber?: string;
  acquisitionDate: string;
  acquisitionCost: number;
  condition?: AssetCondition;
  location: string;
  photoUrl?: string;
  isBookable?: boolean;
  customData?: Record<string, unknown>;
};

export const assetsApi = {
  async listAssets(filters: AssetListFilters = {}) {
    const { data } = await apiClient.get("/assets", { params: filters });
    return (data?.data ?? data) as AssetListResponse;
  },
  async getAsset(id: string) {
    const { data } = await apiClient.get(`/assets/${id}`);
    return (data?.data ?? data) as AssetDetail;
  },
  createAsset(payload: AssetPayload) {
    return apiClient.post("/assets", payload);
  },
  updateAsset(id: string, payload: Partial<AssetPayload>) {
    return apiClient.patch(`/assets/${id}`, payload);
  },
  deleteAsset(id: string) {
    return apiClient.delete(`/assets/${id}`);
  },
};

export const assetsQueryKeys = {
  all: ["assets"] as const,
  list: (filters: AssetListFilters) => ["assets", "list", filters] as const,
  detail: (id: string) => ["assets", id] as const,
};
