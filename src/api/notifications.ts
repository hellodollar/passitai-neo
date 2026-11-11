import type {
  NotificationDetail,
  NotificationItem,
  NotificationList,
  NotificationSummary,
} from '@/types/notification'

import { request } from './http'

export const fetchNotifications = (query: {
  page?: number
  category?: NotificationItem['category']
  unread?: 'true'
}) => request<NotificationList>('/notifications', { query: { ...query, limit: 20 } })
export const fetchNotificationSummary = () => request<NotificationSummary>('/notifications/summary')
export const fetchNotification = (id: string) =>
  request<NotificationDetail>(`/notifications/${encodeURIComponent(id)}`)
export const readNotification = (id: string) =>
  request<{ id: string; readAt: string }>(`/notifications/${encodeURIComponent(id)}/read`, {
    method: 'PUT',
    body: {},
  })
export const readAllNotifications = () =>
  request<{ read: true }>('/notifications/read-all', { method: 'PUT', body: {} })
