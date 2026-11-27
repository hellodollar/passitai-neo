<script setup lang="ts">
import { ChevronRight } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { fetchPracticeRecords } from '@/api/practice'
import { fetchSubjectProfile } from '@/api/subject-profile'
import SubjectEvaluationPopup from '@/components/subject-profile/SubjectEvaluationPopup.vue'
import { useAuthStore } from '@/stores/auth'
import type {
  GeneratedAiEnhancePaper,
  PracticeResource,
  PracticeSubmissionSummary,
  UserSubjectEvaluation,
  UserSubjectProfile,
} from '@/types'
import { formatShanghaiDate } from '@/utils/date'
import {
  formatProfileScore,
  getPassItScoreColorClass,
  summarizeRecentPracticeVolume,
  summarizeResourceTotals,
} from '@/utils/practice/home-stats'

const props = withDefaults(
  defineProps<{
    subjectCode: string
    subjectName?: string
    refreshKey?: number
    resources?: PracticeResource[]
  }>(),
  {
    subjectName: '',
    refreshKey: 0,
    resources: () => [],
  },
)

const emit = defineEmits<{
  'open-paper': [paperId: string]
  'open-mistakes': []
  'ai-generated': [paper: GeneratedAiEnhancePaper]
  'profile-loaded': [profile: UserSubjectProfile | null]
}>()

const auth = useAuthStore()
const profile = ref<UserSubjectProfile | null>(null)
const loading = ref(false)
const error = ref(false)
const reloadTick = ref(0)
const recentVolume = ref<{
  todayAnswered: number
  weeklyAnswered: number
  monthlyAnswered: number
} | null>(null)
const evaluationPopupOpen = ref(false)
const popupInitialEvaluation = ref<UserSubjectEvaluation | null>(null)

const MAX_RECORDS_PAGES = 5
const RECORDS_PAGE_LIMIT = 50

const resourceTotals = computed(() => summarizeResourceTotals(props.resources))

const scoreColorClass = computed(() => getPassItScoreColorClass(profile.value?.latestEvaluation))

async function loadRecentVolume(subjectCode: string, signal: AbortSignal) {
  const collected: PracticeSubmissionSummary[] = []
  const todayDayMs = Date.parse(formatShanghaiDate())
  for (let page = 1; page <= MAX_RECORDS_PAGES; page++) {
    const res = await fetchPracticeRecords({ subjectCode, page, limit: RECORDS_PAGE_LIMIT }, signal)
    if (signal.aborted) return null
    collected.push(...res.items)
    if (res.items.length < RECORDS_PAGE_LIMIT || collected.length >= res.total) break
    const oldest = res.items[res.items.length - 1]
    if (!oldest) break
    const oldestDate = new Date(oldest.createdAt)
    if (Number.isNaN(oldestDate.getTime())) break
    const dayDiff = Math.round(
      (todayDayMs - Date.parse(formatShanghaiDate(oldestDate))) / 86_400_000,
    )
    if (dayDiff >= 30) break
  }
  return summarizeRecentPracticeVolume(collected)
}

function openDetails() {
  popupInitialEvaluation.value = null
  evaluationPopupOpen.value = true
}

function handleEvaluated(evaluation: UserSubjectEvaluation) {
  popupInitialEvaluation.value = evaluation
  reloadTick.value++
}

function handleAiGenerated(paper: GeneratedAiEnhancePaper) {
  reloadTick.value++
  emit('ai-generated', paper)
}

watch(
  [() => props.subjectCode, () => auth.session?.token, () => props.refreshKey, reloadTick],
  async ([code, token], _, onCleanup) => {
    error.value = false
    if (!token || !code) {
      profile.value = null
      recentVolume.value = null
      loading.value = false
      emit('profile-loaded', null)
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    // 切换科目时清空旧画像；同科目静默刷新时保留卡片避免闪烁
    if (profile.value?.subjectCode !== code) {
      profile.value = null
      recentVolume.value = null
      loading.value = true
      emit('profile-loaded', null)
    }

    const [profileResult, volumeResult] = await Promise.allSettled([
      fetchSubjectProfile(code, controller.signal),
      loadRecentVolume(code, controller.signal),
    ])
    if (controller.signal.aborted) return

    if (profileResult.status === 'fulfilled') {
      profile.value = profileResult.value
      emit('profile-loaded', profileResult.value)
    } else {
      error.value = true
      if (!profile.value) emit('profile-loaded', null)
    }

    if (volumeResult.status === 'fulfilled') {
      recentVolume.value = volumeResult.value
    } else {
      recentVolume.value = null
    }

    loading.value = false
  },
  { immediate: true },
)

watch(
  () => auth.session?.token,
  () => {
    evaluationPopupOpen.value = false
    popupInitialEvaluation.value = null
  },
)
</script>

<template>
  <section
    aria-label="PassIt 评分与练习概览"
    class="rounded-2xl bg-base-100 p-3.5 dark:bg-base-200"
  >
    <div v-if="loading && !profile" role="status" aria-label="正在加载…" class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="h-7 w-28 animate-pulse rounded bg-base-200 dark:bg-base-300/70"></span>
        <span class="h-4 w-16 animate-pulse rounded bg-base-200/80 dark:bg-base-300/60"></span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <span
          v-for="index in 4"
          :key="index"
          class="h-10 animate-pulse rounded-xl bg-base-200/65 dark:bg-base-300/45"
        ></span>
      </div>
    </div>

    <div
      v-else-if="error && !profile"
      role="alert"
      class="flex items-center justify-between gap-3 py-0.5"
    >
      <p class="text-xs font-medium text-error">学习概览加载失败</p>
      <button
        type="button"
        class="rounded-lg bg-error/10 px-3 py-1 text-xs font-medium text-error transition-colors active:bg-error/15"
        @click="reloadTick++"
      >
        重试
      </button>
    </div>

    <template v-else-if="profile">
      <!-- 顶部一行：PassIt 评分（4 档 4 色）+ 查看详情 -->
      <div class="flex items-baseline justify-between gap-3">
        <div class="flex min-w-0 items-baseline gap-1.5">
          <span class="text-sm font-semibold tracking-tight text-base-content">PassIt</span>
          <template v-if="profile.latestEvaluation">
            <span
              class="text-[1.75rem] font-bold leading-none tracking-tight tabular-nums"
              :class="scoreColorClass"
            >
              {{ formatProfileScore(profile.latestEvaluation.estimatedScore) }}
            </span>
            <span class="text-xs font-medium text-base-content/50">分</span>
          </template>
          <template v-else>
            <span class="text-xl font-semibold leading-none tabular-nums text-base-content/30">
              —
            </span>
            <span class="text-xs text-base-content/45">未评估</span>
          </template>
        </div>

        <button
          type="button"
          class="inline-flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary transition-opacity active:opacity-70"
          @click="openDetails"
        >
          查看详情
          <ChevronRight :size="14" aria-hidden="true" />
        </button>
      </div>

      <!-- 2×2 块状统计：题集 / 题量 / 今日练习 / 月累计 -->
      <div class="mt-3 grid grid-cols-2 gap-2">
        <div
          class="flex items-baseline justify-between gap-2 rounded-xl bg-base-200/65 px-3 py-2.5 dark:bg-base-300/45"
        >
          <span class="text-xs text-base-content/55">题集</span>
          <span class="text-sm font-semibold leading-none tabular-nums text-base-content">
            {{ resourceTotals.paperCount }}
          </span>
        </div>

        <div
          class="flex items-baseline justify-between gap-2 rounded-xl bg-base-200/65 px-3 py-2.5 dark:bg-base-300/45"
        >
          <span class="text-xs text-base-content/55">题量</span>
          <span class="text-sm font-semibold leading-none tabular-nums text-base-content">
            {{ resourceTotals.questionCount }}
          </span>
        </div>

        <div
          class="flex items-baseline justify-between gap-2 rounded-xl bg-base-200/65 px-3 py-2.5 dark:bg-base-300/45"
        >
          <span class="text-xs text-base-content/55">今日练习</span>
          <span class="text-sm font-semibold leading-none tabular-nums text-base-content">
            {{ recentVolume !== null ? recentVolume.todayAnswered : '—' }}
          </span>
        </div>

        <div
          class="flex items-baseline justify-between gap-2 rounded-xl bg-base-200/65 px-3 py-2.5 dark:bg-base-300/45"
        >
          <span class="text-xs text-base-content/55">月累计</span>
          <span class="text-sm font-semibold leading-none tabular-nums text-base-content">
            {{ recentVolume !== null ? recentVolume.monthlyAnswered : '—' }}
          </span>
        </div>
      </div>
    </template>

    <SubjectEvaluationPopup
      v-model="evaluationPopupOpen"
      :subject-code="subjectCode"
      :subject-name="subjectName || profile?.subjectName"
      :profile="profile"
      :weekly-answered="recentVolume?.weeklyAnswered ?? null"
      :initial-evaluation="popupInitialEvaluation"
      initial-tab="detail"
      @open-paper="emit('open-paper', $event)"
      @open-mistakes="emit('open-mistakes')"
      @ai-generated="handleAiGenerated"
      @evaluated="handleEvaluated"
    />
  </section>
</template>
