import { ref } from 'vue'
import { defineStore } from 'pinia'

import { DEFAULT_APP_PREFERENCES, STORAGE_KEYS } from '@/constants/app'
import type { AppPreferences } from '@/types/domain'
import { readStorage } from '@/utils/storage'

export const useAppStore = defineStore('app', () => {
  const practiceSessionActive = ref(false)

  function bootstrap() {
    // 保留已有用户的主题显示；其余旧侧栏/搜索偏好不再参与当前客户端。
    const preferences = readStorage<AppPreferences>(STORAGE_KEYS.appPreferences, DEFAULT_APP_PREFERENCES)
    document.documentElement.setAttribute('data-theme', preferences.theme || DEFAULT_APP_PREFERENCES.theme)
  }

  function setPracticeSessionActive(active: boolean) {
    practiceSessionActive.value = active
  }

  function startPracticeSession() {
    practiceSessionActive.value = true
  }

  function endPracticeSession() {
    practiceSessionActive.value = false
  }

  return {
    bootstrap,
    practiceSessionActive,
    setPracticeSessionActive,
    startPracticeSession,
    endPracticeSession,
  }
})
