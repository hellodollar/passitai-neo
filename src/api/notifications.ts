import { request } from '@/api/http'
import type { NotificationList, NotificationSettings, NotificationSummary } from '@/types'

/** 文档:GET /api/notifications */
export const fetchNotifications = (query: { page?: number; unread?: 'true' }) =>
  request<NotificationList>('/notifications', { query: { ...query, limit: 20 } })

/** 文档:GET /api/notifications/summary */
export const fetchNotificationSummary = () =>
  request<NotificationSummary>('/notifications/summary', { retry: 0 })

/** 文档:PUT /api/notifications/:id/read */
export const markNotificationRead = (id: string) =>
  request<{ id: string; readAt: string }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PUT',
    body: {},
  })

/** 文档:PUT /api/notifications/read-all */
export const markAllNotificationsRead = () =>
  request<{ read: true }>('/notifications/read-all', { method: 'PUT', body: {} })

/** 文档:GET /api/notifications/settings */
export const fetchNotificationSettings = () =>
  request<NotificationSettings>('/notifications/settings')

/** 文档:PATCH /api/notifications/settings */
export const updateNotificationSettings = (body: Partial<NotificationSettings>) =>
  request<NotificationSettings>('/notifications/settings', { method: 'PATCH', body })
