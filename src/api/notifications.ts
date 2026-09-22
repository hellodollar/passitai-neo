import { request } from '@/api/http'
import type { NotificationSettings } from '@/types/domain'

/** 文档:GET /api/user/settings/notifications */
export function fetchNotificationSettings() {
  return request<NotificationSettings>('/user/settings/notifications')
}

/** 文档:PATCH /api/user/settings/notifications */
export function updateNotificationSettings(payload: Partial<NotificationSettings>) {
  return request<NotificationSettings>('/user/settings/notifications', {
    method: 'PATCH',
    body: payload,
  })
}
