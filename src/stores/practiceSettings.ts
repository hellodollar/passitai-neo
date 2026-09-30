import { ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchPracticeSettings, updatePracticeSettings } from '@/api/practice'
import type { PracticeSettings } from '@/types/domain'

/**
 * 练习设置缓存:首次使用时拉取一次,之后复用;
 * PATCH 成功后用响应回写缓存,登录态变化时清空。
 */
export const usePracticeSettingsStore = defineStore('practiceSettings', () => {
  const settings = ref<PracticeSettings | null>(null)
  const loaded = ref(false)
  let pending: Promise<PracticeSettings | null> | null = null

  /** 确保设置已加载(带并发去重),已缓存时直接返回 */
  async function ensure(): Promise<PracticeSettings | null> {
    if (loaded.value) return settings.value

    pending ??= fetchPracticeSettings()
      .then((value) => {
        settings.value = value
        loaded.value = true
        return value
      })
      .catch(() => null)
      .finally(() => {
        pending = null
      })

    return pending
  }

  /** 保存部分设置并回写缓存 */
  async function patch(payload: Partial<PracticeSettings>) {
    const next = await updatePracticeSettings(payload)
    settings.value = next
    loaded.value = true
    return next
  }

  function clear() {
    settings.value = null
    loaded.value = false
  }

  return { settings, loaded, ensure, patch, clear }
})
