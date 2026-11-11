import { defineStore } from 'pinia'
import { computed, onScopeDispose, ref } from 'vue'

import {
  fetchNotificationSummary,
  readAllNotifications,
  readNotification,
} from '@/api/notifications'
import type { NotificationSummary } from '@/types/notification'
import { currentSessionToken } from '@/utils/auth/session'
import { createSessionGuard } from '@/utils/session-guard'

/** 所有消息入口共用服务端摘要；账号切换作废旧响应，不在本地另算未读数。 */
export const useNotificationsStore = defineStore('notifications', () => {
  const summary = ref<NotificationSummary | null>(null)
  const unreadCount = computed(() => summary.value?.unreadCount ?? 0)
  const guard = createSessionGuard()
  let pending: Promise<void> | undefined
  let refreshedAt = 0
  let stopTracking: (() => void) | undefined

  function refresh(force = false): Promise<void> {
    if (!currentSessionToken()) return Promise.resolve()
    if (pending) return pending
    if (!force && Date.now() - refreshedAt < 15_000) return Promise.resolve()
    const isCurrent = guard.captureRead()
    const promise = fetchNotificationSummary()
      .then((next) => {
        if (isCurrent()) {
          summary.value = next
          refreshedAt = Date.now()
        }
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
    const result = await readNotification(id)
    if (isCurrent()) {
      guard.noteWrite()
      pending = undefined
      await refresh(true)
    }
    return result
  }
  async function markAllRead() {
    const isCurrent = guard.captureWrite()
    await readAllNotifications()
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
    const timer = setInterval(foreground, 60_000)
    window.addEventListener('focus', foreground)
    document.addEventListener('visibilitychange', foreground)
    stopTracking = () => {
      clearInterval(timer)
      window.removeEventListener('focus', foreground)
      document.removeEventListener('visibilitychange', foreground)
    }
    foreground()
  }
  function reset() {
    stop()
    guard.reset()
    pending = undefined
    refreshedAt = 0
    summary.value = null
  }
  onScopeDispose(stop)
  return { summary, unreadCount, refresh, markRead, markAllRead, start, stop, reset }
})
