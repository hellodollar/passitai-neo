import { ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchPlan } from '@/api/plan'
import { fetchMajorOptions, fetchSubjectOptions } from '@/api/options'
import { fetchPracticeEntries } from '@/api/practice'
import type { PracticeEntry, StudyPlan } from '@/types'

/**
 * 首页数据 Store:练习计划、专业→科目ID 映射与题集目录按账号缓存,
 * 页面挂载先读缓存立即渲染,ensure* 按需补拉并做并发去重。
 * clear 通过 generation 作废在途请求,旧响应不写回新账号;
 * applyPlan 额外作废在途的计划刷新,避免后台旧响应覆盖弹框保存的新计划。
 */
export const usePlanStore = defineStore('plan', () => {
  const plan = ref<StudyPlan | null>(null)
  const planLoaded = ref(false)
  const planFetching = ref(false)
  const planFailed = ref(false)

  const entriesBySubjectId = ref(new Map<string, PracticeEntry[]>())
  // majorCode → (subjectCode → subjectId) 纯映射缓存,无需响应式
  const subjectIdMaps = new Map<string, Map<string, string>>()

  let generation = 0
  let planWriteTick = 0
  let planPending: { generation: number; tick: number; promise: Promise<StudyPlan | null> } | null =
    null
  const mapPending = new Map<
    string,
    { generation: number; promise: Promise<Map<string, string> | null> }
  >()
  const entriesPending = new Map<
    string,
    { generation: number; promise: Promise<PracticeEntry[] | null> }
  >()

  /** 确保计划已加载(带并发去重);失败不标记 loaded,下次进入首页自动重试。 */
  function ensurePlan(): Promise<StudyPlan | null> {
    if (planLoaded.value) return Promise.resolve(plan.value)
    if (planPending && planPending.generation === generation && planPending.tick === planWriteTick)
      return planPending.promise

    const requestGeneration = generation
    const requestTick = planWriteTick
    planFetching.value = true
    planFailed.value = false
    const promise = fetchPlan()
      .then((value) => {
        if (requestGeneration !== generation || requestTick !== planWriteTick) return null
        plan.value = value
        planLoaded.value = true
        return value
      })
      .catch(() => {
        if (requestGeneration === generation && requestTick === planWriteTick) {
          planFailed.value = true
        }
        return null
      })
      .finally(() => {
        if (
          planPending?.generation === requestGeneration &&
          planPending.tick === requestTick &&
          planPending.promise === promise
        ) {
          planPending = null
        }
        if (requestGeneration === generation && requestTick === planWriteTick) {
          planFetching.value = false
        }
      })
    planPending = { generation: requestGeneration, tick: requestTick, promise }
    return promise
  }

  /** 计划弹框保存成功后回写缓存;作废在途刷新,避免旧响应覆盖新计划。 */
  function applyPlan(updated: StudyPlan) {
    planWriteTick++
    planPending = null
    planFetching.value = false
    planFailed.value = false
    plan.value = updated
    planLoaded.value = true
  }

  /** 计划只有科目 code;按专业解析 code → subjectId,结果按 majorCode 缓存。 */
  async function ensureSubjectIdMap(majorCode: string): Promise<Map<string, string> | null> {
    if (!majorCode) return null
    const cached = subjectIdMaps.get(majorCode)
    if (cached) return cached
    const pending = mapPending.get(majorCode)
    if (pending && pending.generation === generation) return pending.promise

    const requestGeneration = generation
    const promise = (async () => {
      try {
        const majors = await fetchMajorOptions({ code: majorCode })
        const majorId = majors.find((major) => major.code === majorCode)?.id
        if (!majorId) return null
        const subjects = await fetchSubjectOptions(majorId)
        if (requestGeneration !== generation) return null
        const map = new Map(subjects.map((subject) => [subject.code, subject.id]))
        subjectIdMaps.set(majorCode, map)
        return map
      } catch {
        return null
      }
    })().finally(() => {
      const current = mapPending.get(majorCode)
      if (current && current.promise === promise) mapPending.delete(majorCode)
    })
    mapPending.set(majorCode, { generation: requestGeneration, promise })
    return promise
  }

  /** 确保题集目录已加载(带并发去重);命中缓存直接返回,不重复请求。 */
  async function ensureEntries(subjectId: string): Promise<PracticeEntry[] | null> {
    const cached = entriesBySubjectId.value.get(subjectId)
    if (cached) return cached
    const pending = entriesPending.get(subjectId)
    if (pending && pending.generation === generation) return pending.promise

    const requestGeneration = generation
    const promise = fetchPracticeEntries(subjectId)
      .then((entries) => {
        if (requestGeneration !== generation) return null
        entriesBySubjectId.value = new Map(entriesBySubjectId.value).set(subjectId, entries)
        return entries
      })
      .catch(() => null)
      .finally(() => {
        const current = entriesPending.get(subjectId)
        if (current && current.promise === promise) entriesPending.delete(subjectId)
      })
    entriesPending.set(subjectId, { generation: requestGeneration, promise })
    return promise
  }

  /** 清空缓存并作废在途请求;登录/退出/会话失效时由 auth store 调用。 */
  function clear() {
    generation++
    planWriteTick++
    planPending = null
    mapPending.clear()
    entriesPending.clear()
    plan.value = null
    planLoaded.value = false
    planFetching.value = false
    planFailed.value = false
    subjectIdMaps.clear()
    entriesBySubjectId.value = new Map()
  }

  return {
    applyPlan,
    clear,
    ensureEntries,
    ensurePlan,
    ensureSubjectIdMap,
    entriesBySubjectId,
    plan,
    planFailed,
    planFetching,
    planLoaded,
  }
})
