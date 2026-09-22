import { request } from '@/api/http'
import type {
  UpdatePracticeSettingsBody,
  UpdateUserSettingsBody,
  UserSettings,
} from '@/types/domain'

export function fetchUserSettings() {
  return request<UserSettings>('/settings')
}

export function updatePracticeSettings(payload: UpdatePracticeSettingsBody) {
  return request<UserSettings>('/settings/practice', {
    method: 'PATCH',
    body: payload,
  })
}

export function updateUserSettings(payload: UpdateUserSettingsBody) {
  return request<UserSettings>('/settings', {
    method: 'PATCH',
    body: payload,
  })
}
