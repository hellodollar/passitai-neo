import { defineStore } from 'pinia'
import { ref } from 'vue'

import { SessionChangedError } from '@/api/http'
import { fetchPracticeSettings, updatePracticeSettings } from '@/api/practice'
import type { PracticeSettings } from '@/types'
import { createSessionGuard } from '@/utils/session-guard'

/**
 * 刷题设置 Store：load 按需缓存，save 串行提交局部修改，reset 清理当前会话。
 * reset 经会话守卫使未完成的旧 GET/PATCH 失效,旧响应不写回新会话。
 */
export const usePracticeSettingsStore = defineStore('practice-settings', () => {
  const settings = ref<PracticeSettings | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const guard = createSessionGuard()
  let pending: { promise: Promise<PracticeSettings | null> } | null = null
  let patchChain: Promise<unknown> = Promise.resolve()

  /** 确保设置已加载(带并发去重)，已缓存时直接返回；失败返回 null 以便重试。 */
  function load(): Promise<PracticeSettings | null> {
    if (isLoaded.value) return Promise.resolve(settings.value)
    if (pending) return pending.promise

    const isCurrent = guard.captureRead()
    isLoading.value = true
    error.value = null
    const promise = fetchPracticeSettings()
      .then((value) => {
        if (!isCurrent()) return null
        settings.value = value
        isLoaded.value = true
        return value
      })
      .catch(() => {
        if (isCurrent()) error.value = '刷题设置加载失败'
        return null
      })
      .finally(() => {
        if (pending?.promise === promise) {
          pending = null
          isLoading.value = false
        }
      })

    pending = { promise }
    return promise
  }

  /**
   * 保存部分设置并回写缓存;返回值始终为服务端最新数据。
   * 串行提交:连续拨动多个开关时按调用顺序请求,避免网络乱序导致旧值覆盖新值。
   */
  function save(payload: Partial<PracticeSettings>): Promise<PracticeSettings> {
    const isCurrent = guard.captureWrite()
    // 本地即将写入:作废在途读取,避免旧响应晚到覆盖新值
    guard.noteWrite()
    pending = null
    isLoading.value = false
    const request = patchChain.then(async () => {
      if (!isCurrent()) throw new SessionChangedError()
      const next = await updatePracticeSettings(payload)
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

  /** 清空设置缓存并作废在途请求；不清除本地做题记录。 */
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
    reset,
    load,
    save,
    settings,
    isLoaded,
    isLoading,
    error,
  }
})
