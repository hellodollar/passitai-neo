import { defineStore } from 'pinia'

import { fetchNotificationSettings, updateNotificationSettings } from '@/api/notifications'
import { useRemoteSettings } from '@/composables/useRemoteSettings'

export const useNotificationSettingsStore = defineStore('notification-settings', () =>
  useRemoteSettings(fetchNotificationSettings, updateNotificationSettings, '通知设置加载失败'),
)
