import { request } from '@/api/http'
import type { NotificationSettings } from '@/types/domain'

export function fetchNotificationSettings() {
  return request<NotificationSettings>('/notifications')
}

export function updateNotificationSettings(payload: Partial<NotificationSettings>) {
  return request<NotificationSettings>('/notifications', {
    method: 'PATCH',
    body: payload,
  })
}
