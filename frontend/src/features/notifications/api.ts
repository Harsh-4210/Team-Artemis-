import { apiClient } from "../../lib/apiClient";

export type Notification = { id: string; type: string; title: string; message: string; isRead: boolean; createdAt: string; relatedEntityType: string | null; relatedEntityId: string | null };
export const notificationsApi = {
  async list() { const { data } = await apiClient.get("/notifications"); return (data.data ?? data) as { notifications: Notification[]; unreadCount: number }; },
  markRead(id: string) { return apiClient.patch(`/notifications/${id}/read`); },
  markAllRead() { return apiClient.patch("/notifications/read-all"); },
};
