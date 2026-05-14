import api from './api';

export interface AppNotification {
  id: string;
  type: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
  from_user: {
    id: string;
    username: string;
    email: string;
    avatar: string | null;
  } | null;
}

export const messagesApi = {
  listNotifications: (params?: { limit?: number }) =>
    api
      .get<AppNotification[]>(`messages/notifications/`, { params })
      .then(r => r.data),

  markNotificationRead: (id: string) =>
    api
      .patch<AppNotification>(`messages/notifications/${id}/read/`)
      .then(r => r.data),

  markAllNotificationsRead: () =>
    api.post<{ marked: number }>(`messages/notifications/read-all/`).then(r => r.data),
};
