<script setup lang="ts">
import { GraduationCap, Settings2 } from '@lucide/vue'
import { differenceInCalendarDays, parseISO } from 'date-fns'
import { computed } from 'vue'

import { provinceOptions } from '@/generated/domain-values'
import type { ExamPlan, ExamPlanSubject } from '@/types'
import { formatShanghaiDate } from '@/utils/date'

const props = withDefaults(
  defineProps<{
    plan: ExamPlan
    activeSubject?: ExamPlanSubject | null
  }>(),
  {
    activeSubject: null,
  },
)

const emit = defineEmits<{
  'edit-exam-plan': []
}>()

const provinceName = computed(
  () => provinceOptions.find((province) => province.code === props.plan.provinceCode)?.name ?? '',
)

const majorMetaText = computed(() =>
  [provinceName.value, props.plan.major.educationLevel, props.plan.majorCode]
    .filter(Boolean)
    .join(' · '),
)

const activeNextExam = computed(() => props.activeSubject?.nextExam ?? props.plan.nextExam ?? null)

const nextExamDate = computed(() => {
  const dateValue = activeNextExam.value?.examDate
  if (!dateValue) return null
  const parsedDate = parseISO(dateValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
})

const daysUntilExam = computed(() => {
  if (!nextExamDate.value) return null
  return Math.max(0, differenceInCalendarDays(nextExamDate.value, parseISO(formatShanghaiDate())))
})

const countdownText = computed(() => {
  const days = daysUntilExam.value
  if (days === null) return '无安排'
  return days === 0 ? '今天开考' : days === 1 ? '明天开考' : `距考 ${days} 天`
})

// 次级文字直接展示接口返回的 YYYY-MM-DD 考试日期。
const examDateText = computed(() =>
  nextExamDate.value ? (activeNextExam.value?.examDate ?? '') : '',
)
</script>

<template>
  <section
    aria-label="报考专业与考试时间"
    class="rounded-2xl bg-base-100 px-3.5 py-3 dark:bg-base-200"
  >
    <!-- 左：专业信息；右：倒计时在上、日期在下。两列逐行基线对齐 -->
    <div class="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 gap-y-0.5">
      <h2
        class="col-start-1 row-start-1 truncate text-base font-semibold leading-snug tracking-tight"
      >
        <GraduationCap
          :size="18"
          class="mr-1.5 inline-block align-[-0.1875em] text-primary"
          aria-hidden="true"
        />{{ plan.major.name }}
      </h2>
      <!-- 无考期时只是占位说明，用小字弱色，不与专业名抢视线 -->
      <p
        class="col-start-2 row-start-1 text-right leading-snug tabular-nums"
        :class="
          daysUntilExam === null
            ? 'text-xs text-base-content/45'
            : 'text-sm font-semibold text-primary'
        "
      >
        {{ countdownText }}
      </p>

      <p
        v-if="majorMetaText"
        class="col-start-1 row-start-2 truncate text-xs leading-snug tabular-nums text-base-content/50"
      >
        {{ majorMetaText }}
      </p>
      <p
        v-if="examDateText"
        class="col-start-2 row-start-2 text-right text-xs leading-snug tabular-nums text-base-content/55"
      >
        {{ examDateText }}
      </p>
    </div>

    <button
      class="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary/10 text-sm font-medium text-primary transition-colors active:bg-primary/15 dark:bg-primary/15 dark:active:bg-primary/20"
      type="button"
      @click="emit('edit-exam-plan')"
    >
      <Settings2 :size="16" />
      考试计划
    </button>
  </section>
</template>
