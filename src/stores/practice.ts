import { ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchPracticeSettings, updatePracticeSettings } from '@/api/practice'
import type { PracticeSettings } from '@/types'

/**
 * 练习设置 Store:统一管理刷题设置缓存。
 * 首次按需加载并按账号缓存,登录/退出/失效时清空;
 * clearSettings 通过 generation 使未完成的旧 GET/PATCH 失效,旧响应不写回新会话。
 */
export const usePracticeStore = defineStore('practice', () => {
  const settings = ref<PracticeSettings | null>(null)
  const settingsLoaded = ref(false)

  let generation = 0
  let pending: { generation: number; promise: Promise<PracticeSettings | null> } | null = null
  let patchChain: Promise<unknown> = Promise.resolve()

  /** 确保设置已加载(带并发去重)，已缓存时直接返回；失败返回 null 以便重试。 */
  function ensureSettings(): Promise<PracticeSettings | null> {
    if (settingsLoaded.value) return Promise.resolve(settings.value)
    if (pending && pending.generation === generation) return pending.promise

    const requestGeneration = generation
    const promise = fetchPracticeSettings()
      .then((value) => {
        if (requestGeneration !== generation) return null
        settings.value = value
        settingsLoaded.value = true
        return value
      })
      .catch(() => null)
      .finally(() => {
        if (pending?.generation === requestGeneration && pending.promise === promise) pending = null
      })

    pending = { generation: requestGeneration, promise }
    return promise
  }

  /**
   * 保存部分设置并回写缓存;返回值始终为服务端最新数据。
   * 串行提交:连续拨动多个开关时按调用顺序请求,避免网络乱序导致旧值覆盖新值。
   */
  function patchSettings(payload: Partial<PracticeSettings>): Promise<PracticeSettings> {
    const requestGeneration = generation
    const request = patchChain.then(async () => {
      const next = await updatePracticeSettings(payload)
      if (requestGeneration === generation) {
        settings.value = next
        settingsLoaded.value = true
      }
      return next
    })
    patchChain = request.catch(() => {})
    return request
  }

  /** 清空设置缓存并作废在途请求；不清除本地做题记录。 */
  function clearSettings() {
    generation++
    pending = null
    settings.value = null
    settingsLoaded.value = false
  }

  return {
    clearSettings,
    ensureSettings,
    patchSettings,
    settings,
    settingsLoaded,
  }
})
