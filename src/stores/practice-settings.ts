import { defineStore } from 'pinia'

import { fetchPracticeSettings, updatePracticeSettings } from '@/api/practice'
import { useRemoteSettings } from '@/composables/useRemoteSettings'

export const usePracticeSettingsStore = defineStore('practice-settings', () =>
  useRemoteSettings(fetchPracticeSettings, updatePracticeSettings, '刷题设置加载失败'),
)
