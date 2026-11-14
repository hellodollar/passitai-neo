import { defineStore } from 'pinia'

import { fetchNotificationSettings, patchNotificationSettings } from '@/api/settings'
import { useRemoteSettings } from '@/composables/useRemoteSettings'
export const useNotificationSettingsStore = defineStore('notification-settings', () =>
  useRemoteSettings(fetchNotificationSettings, patchNotificationSettings),
)
