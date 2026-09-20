<script setup lang="ts">
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  CalendarClock,
  ChevronRight,
  FileText,
  PlayCircle,
  Target,
} from '@lucide/vue'
import { differenceInCalendarDays } from 'date-fns'
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'

import TrendChart from '@/components/charts/TrendChart.vue'
import logoPassitai from '@/assets/icons/icon-passitai.svg'
import { useLearningStore } from '@/stores/learning'

const learning = useLearningStore()
const examDate = new Date('2026-10-20T00:00:00+08:00')
const daysUntilExam = computed(() => Math.max(0, differenceInCalendarDays(examDate, new Date())))
const todayStats = computed(() => learning.dashboard?.todayStats)
const subjectCount = computed(() => learning.dashboard?.subjectProgress.length ?? 0)
const primaryActionLabel = computed(() =>
  (todayStats.value?.answeredCount ?? 0) > 0 ? '继续练习' : '开始练习',
)
const todaySummary = computed(() => {
  const count = todayStats.value?.answeredCount
  if (count === undefined) return '正在同步今天的练习进度'
  if (count === 0) return '完成一组练习，开始今天的学习。'
  return `今天已完成 ${count} 题，继续保持节奏。`
})

onMounted(() => {
  learning.loadDashboard()
})
</script>

<template>
  <section class="space-y-5">
    <header class="flex h-9 items-center">
      <img :src="logoPassitai" alt="Passitai" class="h-8 w-auto" />
    </header>

    <section class="overflow-hidden rounded-2xl border border-base-200 bg-base-100">
      <div class="p-4">
        <div class="flex items-start gap-4">
          <div class="min-w-0 flex-1">
            <p class="text-xs font-semibold text-primary">今日练习</p>
            <h1 class="mt-1 text-xl font-semibold leading-tight">{{ primaryActionLabel }}</h1>
            <p class="mt-1.5 text-sm leading-relaxed text-base-content/55">
              {{ todaySummary }}
            </p>
          </div>
          <span
            class="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Target :size="21" />
          </span>
        </div>

        <RouterLink
          class="btn btn-primary mt-4 h-11 min-h-11 w-full rounded-xl text-sm"
          to="/practice"
        >
          <PlayCircle :size="18" />
          {{ primaryActionLabel }}
          <ArrowRight :size="16" />
        </RouterLink>
      </div>

      <div
        class="grid grid-cols-2 divide-x divide-base-200 border-t border-base-200 bg-base-200/30"
      >
        <div class="flex items-center gap-2.5 px-4 py-3">
          <CalendarClock :size="16" class="shrink-0 text-base-content/45" />
          <span class="min-w-0">
            <span class="block text-xs text-base-content/45">距离考试</span>
            <strong class="mt-0.5 block text-sm">{{ daysUntilExam }} 天</strong>
          </span>
        </div>
        <div class="flex items-center gap-2.5 px-4 py-3">
          <FileText :size="16" class="shrink-0 text-base-content/45" />
          <span class="min-w-0">
            <span class="block text-xs text-base-content/45">备考科目</span>
            <strong class="mt-0.5 block text-sm">{{ subjectCount || '-' }} 科</strong>
          </span>
        </div>
      </div>
    </section>

    <section aria-labelledby="overview-heading">
      <div class="mb-3 flex items-center justify-between">
        <h2 id="overview-heading" class="text-lg font-semibold">学习概览</h2>
        <span class="text-xs text-base-content/40">今日</span>
      </div>

      <div
        class="grid grid-cols-3 divide-x divide-base-200 overflow-hidden rounded-2xl border border-base-200 bg-base-100"
      >
        <RouterLink
          to="/wrong-book"
          class="flex min-w-0 flex-col items-center px-2 py-3.5 text-center active:bg-base-200/50"
        >
          <AlertCircle :size="18" class="text-error" />
          <strong class="mt-1.5 text-lg leading-none">{{ todayStats?.wrongCount ?? '-' }}</strong>
          <span class="mt-1 text-xs text-base-content/45">错题</span>
        </RouterLink>
        <RouterLink
          to="/favorites"
          class="flex min-w-0 flex-col items-center px-2 py-3.5 text-center active:bg-base-200/50"
        >
          <Bookmark :size="18" class="text-secondary" />
          <strong class="mt-1.5 text-lg leading-none">{{
            todayStats?.favoriteCount ?? '-'
          }}</strong>
          <span class="mt-1 text-xs text-base-content/45">收藏</span>
        </RouterLink>
        <RouterLink
          to="/practice"
          class="flex min-w-0 flex-col items-center px-2 py-3.5 text-center active:bg-base-200/50"
        >
          <FileText :size="18" class="text-accent" />
          <strong class="mt-1.5 text-lg leading-none">{{ todayStats?.paperCount ?? '-' }}</strong>
          <span class="mt-1 text-xs text-base-content/45">试卷</span>
        </RouterLink>
      </div>
    </section>

    <section aria-labelledby="progress-heading">
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 id="progress-heading" class="text-lg font-semibold">科目进度</h2>
        <RouterLink
          class="flex items-center gap-0.5 text-xs font-medium text-primary"
          to="/practice"
        >
          去练习
          <ChevronRight :size="15" />
        </RouterLink>
      </div>

      <div
        v-if="learning.dashboard"
        class="divide-y divide-base-200 overflow-hidden rounded-2xl border border-base-200 bg-base-100"
      >
        <RouterLink
          v-for="track in learning.dashboard.subjectProgress"
          :key="track.subjectId"
          to="/practice"
          class="flex items-center gap-3 px-4 py-3.5 active:bg-base-200/50"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary"
          >
            {{ track.subjectName.slice(0, 1) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex items-center justify-between gap-3">
              <span class="truncate text-sm font-semibold">{{ track.subjectName }}</span>
              <strong class="shrink-0 text-xs text-primary">{{ track.progress }}%</strong>
            </span>
            <progress
              class="progress progress-primary mt-2 block h-1.5 w-full"
              :value="track.progress"
              max="100"
            ></progress>
            <span class="mt-1.5 block truncate text-xs text-base-content/45">
              {{ track.completedPapers }}/{{ track.totalPapers }} 套练习包已完成
            </span>
          </span>
          <ChevronRight :size="17" class="shrink-0 text-base-content/25" />
        </RouterLink>
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-base-200 p-4">
        <div class="skeleton h-16"></div>
      </div>
    </section>

    <section
      v-if="!learning.dashboard || learning.dashboard.topWrongQuestions.length > 0"
      aria-labelledby="review-heading"
    >
      <div class="mb-3 flex items-center justify-between gap-3">
        <h2 id="review-heading" class="text-lg font-semibold">优先复盘</h2>
        <RouterLink
          class="flex items-center gap-0.5 text-xs font-medium text-primary"
          to="/wrong-book"
        >
          全部错题
          <ChevronRight :size="15" />
        </RouterLink>
      </div>

      <div
        v-if="learning.dashboard"
        class="divide-y divide-base-200 overflow-hidden rounded-2xl border border-base-200 bg-base-100"
      >
        <RouterLink
          v-for="question in learning.dashboard.topWrongQuestions.slice(0, 3)"
          :key="question.qid"
          to="/wrong-book"
          class="flex items-start gap-3 px-4 py-3.5 active:bg-base-200/50"
        >
          <span
            class="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-error/10 text-error"
          >
            <AlertCircle :size="16" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="line-clamp-2 text-sm font-medium leading-relaxed">{{
              question.title
            }}</span>
            <span class="mt-1 flex items-center justify-between gap-3 text-xs">
              <span class="truncate text-base-content/45">{{ question.subjectName }}</span>
              <strong class="shrink-0 font-medium text-error"
                >错 {{ question.wrongCount }} 次</strong
              >
            </span>
          </span>
          <ChevronRight :size="17" class="mt-1 shrink-0 text-base-content/25" />
        </RouterLink>
      </div>

      <div v-else class="overflow-hidden rounded-2xl border border-base-200 p-4">
        <div class="skeleton h-16"></div>
      </div>
    </section>

    <section v-if="learning.dashboard" aria-labelledby="trend-heading">
      <div class="mb-3">
        <h2 id="trend-heading" class="text-lg font-semibold">本周练习</h2>
        <p class="mt-0.5 text-xs text-base-content/45">近 7 天答题量</p>
      </div>
      <div class="overflow-hidden rounded-2xl border border-base-200 bg-base-100 px-3 pb-2 pt-3">
        <TrendChart
          :values="learning.dashboard.weeklyVolume"
          :labels="['一', '二', '三', '四', '五', '六', '日']"
        />
      </div>
    </section>
  </section>
</template>
