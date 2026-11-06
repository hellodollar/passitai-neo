import { defineStore } from 'pinia'
import { ref } from 'vue'

import { SessionChangedError } from '@/api/http'
import { fetchPracticePlan, updatePracticePlan } from '@/api/practice-plan'
import type { PracticePlan, UpdatePracticePlanBody } from '@/types'
import { createSessionGuard } from '@/utils/session-guard'

/** 刷题计划：load 按需缓存，save 保存并更新共享状态，reset 清理当前会话。 */
export const usePracticePlanStore = defineStore('practice-plan', () => {
  const plan = ref<PracticePlan | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const guard = createSessionGuard()
  let pending: { promise: Promise<PracticePlan | null> } | null = null

  function load(): Promise<PracticePlan | null> {
    if (isLoaded.value) return Promise.resolve(plan.value)
    if (pending) return pending.promise
    const isCurrent = guard.captureRead()
    isLoading.value = true
    error.value = null
    const promise = fetchPracticePlan()
      .then((next) => {
        if (!isCurrent()) return null
        plan.value = next
        isLoaded.value = true
        return next
      })
      .catch(() => {
        if (isCurrent()) error.value = '刷题计划加载失败'
        return null
      })
      .finally(() => {
        if (pending?.promise === promise) pending = null
        if (isCurrent()) isLoading.value = false
      })
    pending = { promise }
    return promise
  }

  function applyPracticePlan(next: PracticePlan) {
    guard.noteWrite()
    pending = null
    plan.value = next
    isLoaded.value = true
    isLoading.value = false
    error.value = null
  }

  async function save(body: UpdatePracticePlanBody) {
    const isCurrent = guard.captureWrite()
    const next = await updatePracticePlan(body)
    if (!isCurrent()) throw new SessionChangedError()
    applyPracticePlan(next)
    return next
  }

  function reset() {
    guard.reset()
    pending = null
    plan.value = null
    isLoaded.value = false
    isLoading.value = false
    error.value = null
  }

  return {
    plan,
    isLoaded,
    isLoading,
    error,
    load,
    save,
    reset,
  }
})
