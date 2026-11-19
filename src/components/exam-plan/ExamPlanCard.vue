<script setup lang="ts">
import { GraduationCap, Settings2 } from '@lucide/vue'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { computed } from 'vue'

import { provinceOptions } from '@/generated/domain-values'
import type { ExamPlan } from '@/types'
import { formatShanghaiDate } from '@/utils/notifications'

const props = defineProps<{
  plan: ExamPlan
}>()

const emit = defineEmits<{
  'edit-exam-plan': []
  'edit-settings': []
}>()

const provinceName = computed(
  () => provinceOptions.find((province) => province.code === props.plan.provinceCode)?.name ?? '',
)
const nextExamDate = computed(() => {
  const dateValue = props.plan.nextExam?.examDate
  if (!dateValue) return null
  const parsedDate = parseISO(dateValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
})
const daysUntilExam = computed(() => {
  if (!nextExamDate.value) return null
  return Math.max(0, differenceInCalendarDays(nextExamDate.value, parseISO(formatShanghaiDate())))
})
const nextExamDateText = computed(() =>
  nextExamDate.value ? format(nextExamDate.value, 'yyyy年M月d日') : '',
)
</script>

<template>
  <section class="rounded-2xl bg-base-100 p-3.5 dark:bg-base-200">
    <div class="flex min-w-0 items-center justify-between gap-3">
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-2">
          <h2 class="truncate text-base font-semibold leading-snug tracking-tight">
            {{ plan.major.name }}
          </h2>
          <span
            v-if="plan.major.educationLevel"
            class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary"
          >
            {{ plan.major.educationLevel }}
          </span>
        </div>
        <p
          v-if="provinceName || plan.majorCode || nextExamDateText"
          class="mt-1 truncate text-xs leading-snug text-base-content/55"
        >
          <template v-if="provinceName">{{ provinceName }}</template>
          <template v-if="provinceName && plan.majorCode"> · </template>
          <template v-if="plan.majorCode">代码 {{ plan.majorCode }}</template>
          <template v-if="(provinceName || plan.majorCode) && nextExamDateText"> · </template>
          <template v-if="nextExamDateText">{{ nextExamDateText }}</template>
        </p>
      </div>

      <div
        v-if="nextExamDate"
        class="shrink-0 rounded-xl bg-primary/10 px-3 py-1.5 text-right dark:bg-primary/15"
      >
        <p
          class="flex items-center justify-end gap-1 text-[11px] font-medium leading-none text-primary/75"
        >
          <span class="size-1.5 rounded-full bg-primary"></span>
          距离考试
        </p>
        <p class="mt-1 leading-none">
          <strong class="text-xl font-bold leading-none tracking-tight text-primary tabular-nums">
            {{ daysUntilExam }}
          </strong>
          <span class="ml-0.5 text-[11px] font-medium text-primary/75">天</span>
        </p>
      </div>
      <span
        v-else
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
      >
        <GraduationCap :size="18" />
      </span>
    </div>

    <div class="mt-3 grid grid-cols-2 gap-2">
      <button
        class="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-base-200/65 text-xs font-medium text-base-content/70 transition-colors active:bg-base-200 dark:bg-base-300/45 dark:active:bg-base-300/70"
        type="button"
        aria-label="考试计划"
        @click="emit('edit-exam-plan')"
      >
        <GraduationCap :size="14" class="text-primary" />
        考试计划
      </button>
      <button
        class="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-base-200/65 text-xs font-medium text-base-content/70 transition-colors active:bg-base-200 dark:bg-base-300/45 dark:active:bg-base-300/70"
        type="button"
        aria-label="刷题设置"
        @click="emit('edit-settings')"
      >
        <Settings2 :size="14" class="text-base-content/55" />
        刷题设置
      </button>
    </div>
  </section>
</template>
