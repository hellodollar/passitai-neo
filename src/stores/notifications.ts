import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

import {
  fetchNotificationSummary,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/notifications'
import type { NotificationSummary } from '@/types'
import { currentSessionToken } from '@/utils/auth/session'
import { createSessionGuard } from '@/utils/session-guard'

const AUTO_REFRESH_INTERVAL = 5 * 60 * 1000

/** 所有消息入口共用服务端摘要；账号切换作废旧响应，不在本地另算未读数。 */
export const useNotificationsStore = defineStore('notifications', () => {
  const summary = ref<NotificationSummary | null>(null)
  const unreadCount = computed(() => summary.value?.unreadCount ?? 0)
  const guard = createSessionGuard()
  let pending: Promise<void> | undefined
  let lastRequestedAt: number | undefined
  let stopTracking: (() => void) | undefined

  function refresh(force = false): Promise<void> {
    if (!currentSessionToken()) return Promise.resolve()
    if (pending) return pending
    const now = Date.now()
    if (!force && lastRequestedAt !== undefined && now - lastRequestedAt < AUTO_REFRESH_INTERVAL) {
      return Promise.resolve()
    }
    lastRequestedAt = now
    const isCurrent = guard.captureRead()
    const promise = fetchNotificationSummary()
      .then((next) => {
        if (isCurrent()) summary.value = next
      })
      .catch(() => {
        // 网络故障保留已知摘要；消息页展示列表请求错误并提供重试。
      })
      .finally(() => {
        if (pending === promise) pending = undefined
      })
    pending = promise
    return promise
  }
  async function markRead(id: string) {
    const isCurrent = guard.captureWrite()
    const result = await markNotificationRead(id)
    if (isCurrent()) {
      guard.noteWrite()
      pending = undefined
      await refresh(true)
    }
    return result
  }
  async function markAllRead() {
    const isCurrent = guard.captureWrite()
    await markAllNotificationsRead()
    if (isCurrent()) {
      guard.noteWrite()
      pending = undefined
      await refresh(true)
    }
  }
  function stop() {
    stopTracking?.()
    stopTracking = undefined
  }
  function start() {
    stop()
    if (!currentSessionToken()) return
    const foreground = () => {
      if (document.visibilityState !== 'hidden') void refresh()
    }
    window.addEventListener('focus', foreground)
    document.addEventListener('visibilitychange', foreground)
    stopTracking = () => {
      window.removeEventListener('focus', foreground)
      document.removeEventListener('visibilitychange', foreground)
    }
    foreground()
  }
  function reset() {
    stop()
    guard.reset()
    pending = undefined
    lastRequestedAt = undefined
    summary.value = null
  }
  onScopeDispose(stop)
  return { summary, unreadCount, refresh, markRead, markAllRead, start, stop, reset }
})
