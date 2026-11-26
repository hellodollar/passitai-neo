import { defineStore } from 'pinia'
import { ref } from 'vue'

import { SessionChangedError } from '@/api/http'
import { fetchNotificationSettings, updateNotificationSettings } from '@/api/notifications'
import type { NotificationSettings } from '@/types'
import { createSessionGuard } from '@/utils/session-guard'

export const useNotificationSettingsStore = defineStore('notification-settings', () => {
  const settings = ref<NotificationSettings | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const guard = createSessionGuard()
  let pending: Promise<NotificationSettings | null> | null = null
  let patchChain: Promise<unknown> = Promise.resolve()

  function load(): Promise<NotificationSettings | null> {
    if (isLoaded.value) return Promise.resolve(settings.value)
    if (pending) return pending

    const isCurrent = guard.captureRead()
    isLoading.value = true
    error.value = null
    const promise = fetchNotificationSettings()
      .then((value) => {
        if (!isCurrent()) return null
        settings.value = value
        isLoaded.value = true
        return value
      })
      .catch(() => {
        if (isCurrent()) error.value = '通知设置加载失败'
        return null
      })
      .finally(() => {
        if (pending === promise) {
          pending = null
          isLoading.value = false
        }
      })

    pending = promise
    return promise
  }

  function save(payload: Partial<NotificationSettings>): Promise<NotificationSettings> {
    const isCurrent = guard.captureWrite()
    guard.noteWrite()
    pending = null
    isLoading.value = false
    const request = patchChain.then(async () => {
      if (!isCurrent()) throw new SessionChangedError()
      const next = await updateNotificationSettings(payload)
      if (isCurrent()) {
        guard.noteWrite()
        pending = null
        settings.value = next
        isLoaded.value = true
        error.value = null
      }
      return next
    })
    patchChain = request.catch(() => {})
    return request
  }

  function reset() {
    guard.reset()
    patchChain = Promise.resolve()
    pending = null
    settings.value = null
    isLoaded.value = false
    isLoading.value = false
    error.value = null
  }

  return {
    settings,
    isLoaded,
    isLoading,
    error,
    load,
    save,
    reset,
  }
})
