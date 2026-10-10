import { defineStore } from 'pinia'

import { DEFAULT_APP_PREFERENCES, STORAGE_KEYS } from '@/constants/app'
import type { AppPreferences } from '@/types'
import { readStorage } from '@/utils/storage'

export const useAppStore = defineStore('app', () => {
  function bootstrap() {
    // 保留已有用户的主题显示；其余旧侧栏/搜索偏好不再参与当前客户端。
    const preferences = readStorage<AppPreferences>(
      STORAGE_KEYS.appPreferences,
      DEFAULT_APP_PREFERENCES,
    )
    document.documentElement.setAttribute(
      'data-theme',
      preferences.theme || DEFAULT_APP_PREFERENCES.theme,
    )
  }

  return { bootstrap }
})
