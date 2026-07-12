import { apiClient } from "../../lib/apiClient";

export type AuditCycleStatus = "DRAFT" | "ACTIVE" | "CLOSED";
export type AuditRecordStatus = "PENDING" | "VERIFIED" | "MISSING" | "DAMAGED";

export type AuditSummary = {
  total: number;
  verified: number;
  missing: number;
  damaged: number;
  pending: number;
};

export type AuditAssignment = {
  id: string;
  auditCycleId: string;
  auditorId: string;
  auditor: { id: string; name: string; email: string };
};

export type AuditRecordAsset = {
  id: string;
  assetTag: string;
  name: string;
  location: string;
  status: string;
  condition: string;
  category: { id: string; name: string } | null;
};

export type AuditRecord = {
  id: string;
  auditCycleId: string;
  assetId: string;
  auditorId: string | null;
  status: AuditRecordStatus;
  notes: string | null;
  recordedAt: string | null;
  asset: AuditRecordAsset;
  auditor: { id: string; name: string; email: string } | null;
};

export type AuditCycleListItem = {
  id: string;
  name: string;
  scopeDepartmentId: string | null;
  scopeLocation: string | null;
  startDate: string;
  endDate: string;
  status: AuditCycleStatus;
  createdById: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  scopeDepartment: { id: string; name: string; code: string } | null;
  createdBy: { id: string; name: string; email: string };
  assignments: AuditAssignment[];
  _count: { records: number };
};

export type AuditCycleDetail = AuditCycleListItem & { records: AuditRecord[] };

export type AuditCycleDetailResponse = {
  cycle: AuditCycleDetail;
  summary: AuditSummary;
};

export type AuditCloseResponse = {
  cycle: AuditCycleListItem;
  summary: AuditSummary;
  missingAssets: Array<{ id: string; assetTag: string; name: string }>;
  damagedAssets: Array<{ id: string; assetTag: string; name: string; maintenanceRequestId: string | null }>;
};

export type CreateAuditCyclePayload = {
  name: string;
  scopeDepartmentId?: string;
  scopeLocation?: string;
  startDate: string;
  endDate: string;
};

export type ListAuditCyclesFilters = {
  status?: AuditCycleStatus;
};

export const auditsApi = {
  async listCycles(filters: ListAuditCyclesFilters = {}) {
    const { data } = await apiClient.get("/audit-cycles", { params: filters });
    return (data?.data ?? data) as AuditCycleListItem[];
  },
  async getCycle(id: string) {
    const { data } = await apiClient.get(`/audit-cycles/${id}`);
    return (data?.data ?? data) as AuditCycleDetailResponse;
  },
  async createCycle(payload: CreateAuditCyclePayload) {
    const { data } = await apiClient.post("/audit-cycles", payload);
    return (data?.data ?? data) as AuditCycleListItem;
  },
  async assignAuditors(id: string, auditorIds: string[]) {
    const { data } = await apiClient.post(`/audit-cycles/${id}/assign`, { auditorIds });
    return (data?.data ?? data) as AuditCycleDetailResponse;
  },
  async activateCycle(id: string) {
    const { data } = await apiClient.post(`/audit-cycles/${id}/activate`, {});
    return (data?.data ?? data) as AuditCycleDetailResponse;
  },
  async closeCycle(id: string) {
    const { data } = await apiClient.post(`/audit-cycles/${id}/close`, {});
    return (data?.data ?? data) as AuditCloseResponse;
  },
  async recordStatus(recordId: string, payload: { status: AuditRecordStatus; notes?: string }) {
    const { data } = await apiClient.patch(`/audit-records/${recordId}`, payload);
    return (data?.data ?? data) as AuditRecord;
  },
};

export const auditsQueryKeys = {
  all: ["audits"] as const,
  list: (filters: ListAuditCyclesFilters) => ["audits", "list", filters] as const,
  detail: (id: string) => ["audits", "detail", id] as const,
};
