import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchPracticeEntries } from '@/api/practice'
import { createSessionGuard } from '@/utils/session-guard'
import type { PracticeEntry } from '@/types'

/** 题集入口按当前会话、省份和科目缓存；不承担用户资料、刷题计划或设置。 */
export const usePracticeEntriesStore = defineStore('practice-entries', () => {
  const entriesBySubjectId = ref(new Map<string, PracticeEntry[]>())
  const entriesPending = new Map<string, Promise<PracticeEntry[] | null>>()
  const guard = createSessionGuard()

  function cacheKey(subjectId: string, provinceCode?: string) {
    return `${provinceCode ?? ''}|${subjectId}`
  }

  function load(subjectId: string, provinceCode?: string): Promise<PracticeEntry[] | null> {
    const key = cacheKey(subjectId, provinceCode)
    const cached = entriesBySubjectId.value.get(key)
    if (cached) return Promise.resolve(cached)
    const pendingEntry = entriesPending.get(key)
    if (pendingEntry) return pendingEntry
    const isCurrent = guard.captureRead()
    const promise = fetchPracticeEntries(subjectId, provinceCode)
      .then((next) => {
        if (!isCurrent()) return null
        entriesBySubjectId.value = new Map(entriesBySubjectId.value).set(key, next)
        return next
      })
      .catch(() => null)
      .finally(() => {
        if (entriesPending.get(key) === promise) entriesPending.delete(key)
      })
    entriesPending.set(key, promise)
    return promise
  }

  function reset() {
    guard.reset()
    entriesPending.clear()
    entriesBySubjectId.value = new Map()
  }

  return { entriesBySubjectId, load, reset }
})
