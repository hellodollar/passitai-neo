import { defineStore } from 'pinia'

import { fetchPapers } from '@/api/papers'
import type { PaginationResult } from '@/types/api'
import type { Paper, PaperType } from '@/types/paper'
import { createSessionGuard } from '@/utils/session-guard'

export const usePapersStore = defineStore('papers', () => {
  const pages = new Map<string, PaginationResult<Paper>>()
  const pending = new Map<string, Promise<PaginationResult<Paper> | null>>()
  const guard = createSessionGuard()

  function load(subjectCode: string, page: number, type?: PaperType) {
    const key = `${subjectCode}:${page}:${type ?? ''}`
    const cached = pages.get(key)
    if (cached) return Promise.resolve(cached)
    const inFlight = pending.get(key)
    if (inFlight) return inFlight

    const isCurrent = guard.captureRead()
    const promise = fetchPapers(subjectCode, page, type)
      .then((result) => {
        if (!isCurrent()) return null
        pages.set(key, result)
        return result
      })
      .finally(() => {
        if (pending.get(key) === promise) pending.delete(key)
      })
    pending.set(key, promise)
    return promise
  }

  function reset() {
    guard.reset()
    pending.clear()
    pages.clear()
  }

  return { load, reset }
})
