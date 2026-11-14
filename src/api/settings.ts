import { request } from '@/api/http'
import type { NotificationSettings } from '@/types/settings'
export const fetchNotificationSettings = () =>
  request<NotificationSettings>('/notifications/settings')
export const patchNotificationSettings = (body: Partial<NotificationSettings>) =>
  request<NotificationSettings>('/notifications/settings', { method: 'PATCH', body })
