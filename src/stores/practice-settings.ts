import { ref } from 'vue'
import { defineStore } from 'pinia'
import { SessionChangedError } from '@/api/http'
import { currentSessionToken } from '@/utils/auth/session'

import { fetchPracticeSettings, updatePracticeSettings } from '@/api/practice'
import type { PracticeSettings } from '@/types'

/**
 * 刷题设置 Store：load 按需缓存，save 串行提交局部修改，reset 清理当前会话。
 * 首次按需加载并按账号缓存,登录/退出/失效时清空;
 * reset 通过 generation 使未完成的旧 GET/PATCH 失效,旧响应不写回新会话。
 */
export const usePracticeSettingsStore = defineStore('practice-settings', () => {
  const settings = ref<PracticeSettings | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  let generation = 0
  let writeTick = 0
  let pending: { generation: number; promise: Promise<PracticeSettings | null> } | null = null
  let patchChain: Promise<unknown> = Promise.resolve()

  /** 确保设置已加载(带并发去重)，已缓存时直接返回；失败返回 null 以便重试。 */
  function load(): Promise<PracticeSettings | null> {
    if (isLoaded.value) return Promise.resolve(settings.value)
    if (pending && pending.generation === generation) return pending.promise

    isLoading.value = true
    error.value = null
    const requestGeneration = generation
    const requestTick = writeTick
    const requestToken = currentSessionToken()
    const promise = fetchPracticeSettings()
      .then((value) => {
        if (
          requestGeneration !== generation ||
          requestTick !== writeTick ||
          requestToken !== currentSessionToken()
        )
          return null
        settings.value = value
        isLoaded.value = true
        return value
      })
      .catch(() => {
        if (
          requestGeneration === generation &&
          requestTick === writeTick &&
          requestToken === currentSessionToken()
        ) {
          error.value = '刷题设置加载失败'
        }
        return null
      })
      .finally(() => {
        if (pending?.generation === requestGeneration && pending.promise === promise) {
          pending = null
          isLoading.value = false
        }
      })

    pending = { generation: requestGeneration, promise }
    return promise
  }

  /**
   * 保存部分设置并回写缓存;返回值始终为服务端最新数据。
   * 串行提交:连续拨动多个开关时按调用顺序请求,避免网络乱序导致旧值覆盖新值。
   */
  function save(payload: Partial<PracticeSettings>): Promise<PracticeSettings> {
    const requestGeneration = generation
    const requestToken = currentSessionToken()
    writeTick++
    pending = null
    isLoading.value = false
    const request = patchChain.then(async () => {
      if (requestGeneration !== generation || requestToken !== currentSessionToken()) {
        throw new SessionChangedError()
      }
      const next = await updatePracticeSettings(payload)
      if (requestGeneration === generation && requestToken === currentSessionToken()) {
        writeTick++
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
    generation++
    writeTick++
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
