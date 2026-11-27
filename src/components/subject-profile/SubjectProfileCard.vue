<script setup lang="ts">
import { BookOpen, CalendarDays, ChevronRight, Layers, ListChecks, Sparkles } from '@lucide/vue'
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
  <section aria-label="PassIt 评分与练习概览" class="rounded-2xl bg-base-100 p-3 dark:bg-base-200">
    <div v-if="loading && !profile" role="status" aria-label="正在加载…" class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <span class="h-12 w-36 animate-pulse rounded-xl bg-primary/5 dark:bg-primary/10"></span>
        <span class="h-4 w-16 animate-pulse rounded bg-base-200/80 dark:bg-base-300/60"></span>
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <span
          v-for="index in 4"
          :key="index"
          class="h-8 animate-pulse rounded-lg bg-base-200/65 dark:bg-base-300/45"
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
      <!-- 与详情统一品牌分数区，未评估保留中性占位。 -->
      <div
        class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl bg-primary/5 px-3 py-2.5 dark:bg-primary/10"
      >
        <div class="flex min-w-0 items-center gap-1.5">
          <Sparkles :size="14" class="text-primary" aria-hidden="true" />
          <span class="text-sm font-semibold tracking-tight text-primary">PassIt</span>
          <template v-if="profile.latestEvaluation">
            <span
              class="ml-1 bg-linear-to-br from-primary to-ai bg-clip-text text-4xl font-semibold leading-none tracking-tighter text-transparent tabular-nums"
            >
              {{ formatProfileScore(profile.latestEvaluation.estimatedScore) }}
            </span>
            <span class="self-end pb-0.5 text-xs text-base-content/55">分</span>
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
          aria-label="查看评估详情"
          @click="openDetails"
        >
          详情
          <ChevronRight :size="14" aria-hidden="true" />
        </button>
      </div>

      <!-- 2×2 块状统计：题集 / 题量 / 今日练习 / 月累计 -->
      <div class="mt-2 grid grid-cols-2 gap-1.5">
        <div
          class="flex min-w-0 items-center justify-between gap-1.5 rounded-lg bg-base-200/65 px-2.5 py-2 dark:bg-base-300/45"
        >
          <span
            class="flex min-w-0 items-center gap-1 text-[11px] leading-snug text-base-content/55"
            ><Layers :size="12" class="text-base-content/40" aria-hidden="true" />题集</span
          >
          <span
            class="shrink-0 text-base font-semibold leading-none tabular-nums text-base-content"
          >
            {{ resourceTotals.paperCount }}
          </span>
        </div>

        <div
          class="flex min-w-0 items-center justify-between gap-1.5 rounded-lg bg-base-200/65 px-2.5 py-2 dark:bg-base-300/45"
        >
          <span
            class="flex min-w-0 items-center gap-1 text-[11px] leading-snug text-base-content/55"
            ><ListChecks :size="12" class="text-base-content/40" aria-hidden="true" />题量</span
          >
          <span
            class="shrink-0 text-base font-semibold leading-none tabular-nums text-base-content"
          >
            {{ resourceTotals.questionCount }}
          </span>
        </div>

        <div
          class="flex min-w-0 items-center justify-between gap-1.5 rounded-lg bg-base-200/65 px-2.5 py-2 dark:bg-base-300/45"
        >
          <span
            class="flex min-w-0 items-center gap-1 text-[11px] leading-snug text-base-content/55"
            ><BookOpen :size="12" class="text-base-content/40" aria-hidden="true" />今日练习</span
          >
          <span
            class="shrink-0 text-base font-semibold leading-none tabular-nums text-base-content"
          >
            {{ recentVolume !== null ? recentVolume.todayAnswered : '—' }}
          </span>
        </div>

        <div
          class="flex min-w-0 items-center justify-between gap-1.5 rounded-lg bg-base-200/65 px-2.5 py-2 dark:bg-base-300/45"
        >
          <span
            class="flex min-w-0 items-center gap-1 text-[11px] leading-snug text-base-content/55"
            ><CalendarDays :size="12" class="text-base-content/40" aria-hidden="true" />月累计</span
          >
          <span
            class="shrink-0 text-base font-semibold leading-none tabular-nums text-base-content"
          >
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
