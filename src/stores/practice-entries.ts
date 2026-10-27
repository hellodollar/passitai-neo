import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchPracticeEntries } from '@/api/practice'
import { currentSessionToken } from '@/utils/auth-session'
import type { PracticeEntry } from '@/types'

/** 题集入口按当前会话和科目缓存；不承担用户资料、刷题计划或设置。 */
export const usePracticeEntriesStore = defineStore('practice-entries', () => {
  const entriesBySubjectId = ref(new Map<string, PracticeEntry[]>())
  const entriesPending = new Map<string, Promise<PracticeEntry[] | null>>()
  let generation = 0

  function load(subjectId: string): Promise<PracticeEntry[] | null> {
    const cached = entriesBySubjectId.value.get(subjectId)
    if (cached) return Promise.resolve(cached)
    const pendingEntry = entriesPending.get(subjectId)
    if (pendingEntry) return pendingEntry
    const requestGeneration = generation
    const token = currentSessionToken()
    const promise = fetchPracticeEntries(subjectId)
      .then((next) => {
        if (requestGeneration !== generation || token !== currentSessionToken()) return null
        entriesBySubjectId.value = new Map(entriesBySubjectId.value).set(subjectId, next)
        return next
      })
      .catch(() => null)
      .finally(() => {
        if (entriesPending.get(subjectId) === promise) entriesPending.delete(subjectId)
      })
    entriesPending.set(subjectId, promise)
    return promise
  }

  function reset() {
    generation++
    entriesPending.clear()
    entriesBySubjectId.value = new Map()
  }

  return { entriesBySubjectId, load, reset }
})
