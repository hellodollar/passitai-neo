import { defineStore } from 'pinia'
import { onScopeDispose, ref } from 'vue'

import { STORAGE_KEYS } from '@/constants/app'
import type { AuthSession, PracticeSettings } from '@/types'
import { readStorage, writeStorage } from '@/utils/storage'

export const DEFAULT_PRACTICE_SETTINGS: PracticeSettings = {
  shuffleQuestions: false,
  autoNext: false,
  recordWrongQuestions: true,
  autoSubmitAfterCompletion: false,
  removeMistakeOnCorrect: false,
}

export function normalizePracticeSettings(value: unknown): PracticeSettings {
  const raw = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const flag = (key: keyof PracticeSettings) =>
    typeof raw[key] === 'boolean' ? raw[key] : DEFAULT_PRACTICE_SETTINGS[key]
  return {
    shuffleQuestions: flag('shuffleQuestions'),
    autoNext: flag('autoNext'),
    recordWrongQuestions: flag('recordWrongQuestions'),
    autoSubmitAfterCompletion: flag('autoSubmitAfterCompletion'),
    removeMistakeOnCorrect: flag('removeMistakeOnCorrect'),
  }
}

export function practiceSettingsStorageKey(userId: string) {
  return `${STORAGE_KEYS.practiceSettingsPrefix}${encodeURIComponent(userId)}`
}

/**
 * 刷题设置 Store：纯本地按用户 ID 持久化，登出不清理，下次同账号登录直接恢复。
 */
export const usePracticeSettingsStore = defineStore('practice-settings', () => {
  let boundUserId: string | null = null
  const settings = ref<PracticeSettings>({ ...DEFAULT_PRACTICE_SETTINGS })

  function resolveUserId(explicitUserId?: string): string {
    if (typeof explicitUserId === 'string') return explicitUserId
    const stored = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
    if (typeof stored?.user?.id === 'string' && stored.user.id) return stored.user.id
    return boundUserId ?? ''
  }

  function load(explicitUserId?: string): PracticeSettings {
    const userId = resolveUserId(explicitUserId)
    boundUserId = userId
    if (!userId) {
      settings.value = { ...DEFAULT_PRACTICE_SETTINGS }
      return settings.value
    }
    const stored = readStorage<unknown>(practiceSettingsStorageKey(userId), null)
    settings.value = normalizePracticeSettings(stored)
    return settings.value
  }

  function save(patch: Partial<PracticeSettings>, explicitUserId?: string): PracticeSettings {
    const userId = resolveUserId(explicitUserId)
    if (userId !== boundUserId) load(userId)
    const next = normalizePracticeSettings({ ...settings.value, ...patch })
    settings.value = next
    if (userId) writeStorage(practiceSettingsStorageKey(userId), next)
    return next
  }

  /** 会话切换或登出时只切换内存视图，不删除 localStorage 中已保存的用户偏好。 */
  function reset(nextUserId = '') {
    load(nextUserId)
  }

  load()

  if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
    const onStorage = (event: StorageEvent) => {
      const userId = resolveUserId()
      if (
        event.key === null ||
        event.key === STORAGE_KEYS.authSession ||
        (userId && event.key === practiceSettingsStorageKey(userId))
      ) {
        load()
      }
    }
    window.addEventListener('storage', onStorage)
    onScopeDispose(() => window.removeEventListener('storage', onStorage))
  }

  return {
    settings,
    load,
    save,
    reset,
  }
})
