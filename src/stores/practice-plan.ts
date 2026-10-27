import { ref } from 'vue'
import { defineStore } from 'pinia'
import { fetchPracticePlan, updatePracticePlan } from '@/api/practice-plan'
import { SessionChangedError } from '@/api/http'
import { currentSessionToken } from '@/utils/auth/session'
import type { PracticePlan, UpdatePracticePlanBody } from '@/types'

/** 刷题计划：load 按需缓存，save 保存并更新共享状态，reset 清理当前会话。 */
export const usePracticePlanStore = defineStore('practice-plan', () => {
  const plan = ref<PracticePlan | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  let generation = 0
  let writeTick = 0
  let pending: { promise: Promise<PracticePlan | null> } | null = null

  function load(): Promise<PracticePlan | null> {
    if (isLoaded.value) return Promise.resolve(plan.value)
    if (pending) return pending.promise
    const requestGeneration = generation
    const requestTick = writeTick
    const token = currentSessionToken()
    isLoading.value = true
    error.value = null
    const isCurrent = () =>
      requestGeneration === generation &&
      requestTick === writeTick &&
      token === currentSessionToken()
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
    writeTick++
    pending = null
    plan.value = next
    isLoaded.value = true
    isLoading.value = false
    error.value = null
  }

  async function save(body: UpdatePracticePlanBody) {
    const requestGeneration = generation
    const token = currentSessionToken()
    const next = await updatePracticePlan(body)
    if (requestGeneration !== generation || token !== currentSessionToken()) {
      throw new SessionChangedError()
    }
    applyPracticePlan(next)
    return next
  }

  function reset() {
    generation++
    writeTick++
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
