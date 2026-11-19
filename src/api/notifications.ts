import type { NotificationList, NotificationSummary } from '@/types'

import { request } from './http'

export const fetchNotifications = (query: { page?: number; unread?: 'true' }) =>
  request<NotificationList>('/notifications', { query: { ...query, limit: 20 } })
export const fetchNotificationSummary = () =>
  request<NotificationSummary>('/notifications/summary', { retry: 0 })
export const readNotification = (id: string) =>
  request<{ id: string; readAt: string }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PUT',
    body: {},
  })
export const readAllNotifications = () =>
  request<{ read: true }>('/notifications/read-all', { method: 'PUT', body: {} })
