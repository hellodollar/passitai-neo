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
  <section class="rounded-2xl bg-base-200/85 p-3 dark:bg-base-200/65">
    <div class="flex min-w-0 items-center justify-between gap-2.5 px-0.5">
      <div class="min-w-0 flex-1">
        <div class="flex min-w-0 items-center gap-1.5">
          <h2 class="truncate text-base font-bold leading-snug">{{ plan.major.name }}</h2>
          <span
            v-if="plan.major.educationLevel"
            class="shrink-0 rounded-md bg-primary/12 px-1.5 py-0.5 text-[11px] font-semibold text-primary"
          >
            {{ plan.major.educationLevel }}
          </span>
        </div>
        <p
          v-if="provinceName || plan.majorCode || nextExamDateText"
          class="mt-1 truncate text-xs text-base-content/60"
        >
          <template v-if="provinceName">{{ provinceName }}</template>
          <template v-if="provinceName && plan.majorCode"> · </template>
          <template v-if="plan.majorCode">代码 {{ plan.majorCode }}</template>
          <template v-if="(provinceName || plan.majorCode) && nextExamDateText"> · </template>
          <template v-if="nextExamDateText">{{ nextExamDateText }}</template>
        </p>
      </div>

      <div v-if="nextExamDate" class="shrink-0 rounded-xl bg-base-100 px-2.5 py-1.5 text-right">
        <p
          class="flex items-center justify-end gap-1 text-[10px] leading-none text-base-content/55"
        >
          <span class="size-1.5 rounded-full bg-primary"></span>
          距离考试
        </p>
        <p class="mt-1 text-xs leading-none text-base-content/65">
          <strong class="text-base font-bold leading-none text-primary tabular-nums">
            {{ daysUntilExam }}
          </strong>
          天
        </p>
      </div>
      <span
        v-else
        class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-base-100 text-primary"
      >
        <GraduationCap :size="18" />
      </span>
    </div>

    <div class="mt-2.5 grid grid-cols-2 gap-2">
      <button
        class="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-base-100 text-xs font-semibold text-base-content/80 transition-colors active:bg-base-100/75"
        type="button"
        aria-label="考试计划"
        @click="emit('edit-exam-plan')"
      >
        <GraduationCap :size="15" class="text-primary" />
        考试计划
      </button>
      <button
        class="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-base-100 text-xs font-semibold text-base-content/80 transition-colors active:bg-base-100/75"
        type="button"
        aria-label="刷题设置"
        @click="emit('edit-settings')"
      >
        <Settings2 :size="15" class="text-secondary" />
        刷题设置
      </button>
    </div>
  </section>
</template>
