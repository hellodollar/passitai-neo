<script setup lang="ts">
import {
  AlertCircle,
  ArrowRight,
  Bookmark,
  CalendarClock,
  CheckCircle2,
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

onMounted(() => {
  learning.loadDashboard()
})
</script>

<template>
  <section class="space-y-5">
    <header class="flex items-center gap-3">
      <img :src="logoPassitai" alt="Passitai" class="h-8 w-auto" />
    </header>

    <section class="rounded-2xl border border-base-200 bg-base-100 p-4">
      <div class="flex items-center gap-4">
        <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Target :size="22" />
        </span>
        <div class="min-w-0 flex-1">
          <h2 class="text-lg font-semibold leading-tight">今日看板</h2>
          <p class="mt-1 text-sm text-base-content/55">先完成一轮练习，再回来处理错题。</p>
        </div>
        <div class="text-right">
          <strong class="block text-2xl leading-none">{{ todayStats?.answeredCount ?? '-' }}</strong>
          <span class="text-xs text-base-content/50">已答题</span>
        </div>
      </div>

      <div class="mt-5 divide-y divide-base-200 border-y border-base-200">
        <div class="flex items-center justify-between gap-3 py-3">
          <div class="flex items-center gap-3">
            <CalendarClock :size="14" />
            <span class="text-sm text-base-content/60">考试倒计时</span>
          </div>
          <strong class="text-sm">{{ daysUntilExam }} 天</strong>
        </div>
        <div class="flex items-center justify-between gap-3 py-3">
          <div class="flex items-center gap-3">
            <CheckCircle2 :size="14" />
            <span class="text-sm text-base-content/60">本次报考</span>
          </div>
          <strong class="text-sm">4 科</strong>
        </div>
      </div>

      <RouterLink class="btn btn-primary mt-4 h-11 w-full rounded-full gap-2" to="/practice">
        <PlayCircle :size="18" />
        开始练习
      </RouterLink>
    </section>

    <section class="grid grid-cols-3 gap-3">
      <RouterLink to="/wrong-book" class="flex items-center gap-2 rounded-2xl bg-base-200/70 p-3">
        <AlertCircle :size="18" class="text-error" />
        <span class="min-w-0">
          <span class="block text-xs text-base-content/50">错题</span>
          <strong class="block text-base">{{ todayStats?.wrongCount ?? '-' }}</strong>
        </span>
      </RouterLink>
      <RouterLink to="/favorites" class="flex items-center gap-2 rounded-2xl bg-base-200/70 p-3">
        <Bookmark :size="18" class="text-secondary" />
        <span class="min-w-0">
          <span class="block text-xs text-base-content/50">收藏</span>
          <strong class="block text-base">{{ todayStats?.favoriteCount ?? '-' }}</strong>
        </span>
      </RouterLink>
      <RouterLink to="/practice" class="flex items-center gap-2 rounded-2xl bg-base-200/70 p-3">
        <FileText :size="18" class="text-accent" />
        <span class="min-w-0">
          <span class="block text-xs text-base-content/50">试卷</span>
          <strong class="block text-base">{{ todayStats?.paperCount ?? '-' }}</strong>
        </span>
      </RouterLink>
    </section>

    <section>
      <div class="mb-3">
        <h2 class="text-lg font-semibold">刷题进度</h2>
      </div>

      <div v-if="learning.dashboard" class="divide-y divide-base-200">
        <article
          v-for="track in learning.dashboard.subjectProgress"
          :key="track.subjectId"
          class="flex items-center gap-4 py-3"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-base font-semibold text-primary-content">
            {{ track.subjectName.slice(0, 1) }}
          </span>
          <div class="min-w-0 flex-1 border-b border-base-200 pb-3">
            <div class="flex items-center justify-between gap-3">
              <h3 class="truncate text-base font-medium">{{ track.subjectName }}</h3>
              <span class="text-sm font-semibold text-primary">{{ track.progress }}%</span>
            </div>
            <p class="mt-1 truncate text-sm text-base-content/50">
              {{ track.completedPapers }}/{{ track.totalPapers }} 套练习包已完成
            </p>
          </div>
        </article>
      </div>

      <div v-else class="pt-3">
        <div class="skeleton h-20"></div>
      </div>
    </section>

    <section>
      <div class="mb-3">
        <h2 class="text-lg font-semibold">优先复盘</h2>
      </div>

      <div v-if="learning.dashboard" class="divide-y divide-base-200">
        <RouterLink
          v-for="question in learning.dashboard.topWrongQuestions.slice(0, 3)"
          :key="question.qid"
          to="/wrong-book"
          class="flex items-start gap-4 py-3"
        >
          <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error">
            <AlertCircle :size="20" />
          </span>
          <div class="min-w-0 flex-1 border-b border-base-200 pb-3">
            <div class="flex items-start justify-between gap-3">
              <h3 class="line-clamp-2 text-base font-medium leading-relaxed">{{ question.title }}</h3>
              <span class="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-content">
                {{ question.wrongCount }}
              </span>
            </div>
            <p class="mt-1 truncate text-sm text-base-content/50">{{ question.subjectName }}</p>
          </div>
        </RouterLink>
      </div>

      <div v-else class="pt-3">
        <div class="skeleton h-16"></div>
      </div>
    </section>

    <TrendChart v-if="learning.dashboard" :values="learning.dashboard.weeklyVolume" />
  </section>
</template>
