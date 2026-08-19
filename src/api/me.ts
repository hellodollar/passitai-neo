import { request } from '@/api/http'
import type {
  UpdateUserPreferencesBody,
  UpdateUserSettingsBody,
  UserMe,
  UserPreferences,
  UserSettings,
} from '@/types/domain'

export function fetchUserMe() {
  return request<UserMe>('/me')
}

export function updateUserPreferences(payload: UpdateUserPreferencesBody) {
  return request<UserPreferences>('/preferences', {
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
