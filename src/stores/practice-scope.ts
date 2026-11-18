import { defineStore } from 'pinia'
import { ref } from 'vue'

import { SessionChangedError } from '@/api/http'
import { fetchPracticeScope, updatePracticeScope } from '@/api/practice-scope'
import type { PracticeScope, UpdatePracticeScopeBody } from '@/types'
import { createSessionGuard } from '@/utils/session-guard'

/** 备考范围：load 按需缓存，save 保存并更新共享状态，reset 清理当前会话。 */
export const usePracticeScopeStore = defineStore('practice-scope', () => {
  const scope = ref<PracticeScope | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const guard = createSessionGuard()
  let pending: { promise: Promise<PracticeScope | null> } | null = null

  function load(): Promise<PracticeScope | null> {
    if (isLoaded.value) return Promise.resolve(scope.value)
    if (pending) return pending.promise
    const isCurrent = guard.captureRead()
    isLoading.value = true
    error.value = null
    const promise = fetchPracticeScope()
      .then((next) => {
        if (!isCurrent()) return null
        scope.value = next
        isLoaded.value = true
        return next
      })
      .catch(() => {
        if (isCurrent()) error.value = '备考范围加载失败'
        return null
      })
      .finally(() => {
        if (pending?.promise === promise) pending = null
        if (isCurrent()) isLoading.value = false
      })
    pending = { promise }
    return promise
  }

  function applyPracticeScope(next: PracticeScope) {
    guard.noteWrite()
    pending = null
    scope.value = next
    isLoaded.value = true
    isLoading.value = false
    error.value = null
  }

  async function save(body: UpdatePracticeScopeBody) {
    const isCurrent = guard.captureWrite()
    const next = await updatePracticeScope(body)
    if (!isCurrent()) throw new SessionChangedError()
    applyPracticeScope(next)
    return next
  }

  function reset() {
    guard.reset()
    pending = null
    scope.value = null
    isLoaded.value = false
    isLoading.value = false
    error.value = null
  }

  return {
    scope,
    isLoaded,
    isLoading,
    error,
    load,
    save,
    reset,
  }
})
