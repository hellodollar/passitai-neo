<script setup lang="ts">
import { ClipboardList, GraduationCap, Settings2 } from '@lucide/vue'
import { differenceInCalendarDays, format } from 'date-fns'
import { computed } from 'vue'

import { provinceOptions } from '@/generated/domain-values'
import type { PracticePlan } from '@/types'

const props = defineProps<{
  plan: PracticePlan
}>()

const emit = defineEmits<{
  'edit-plan': []
  'edit-settings': []
}>()

const planProvinceName = computed(
  () => provinceOptions.find((province) => province.code === props.plan.provinceCode)?.name ?? '',
)
const nextExamDate = computed(() => {
  const dateValue = props.plan.nextExamDate
  if (!dateValue) return null
  const parsedDate = new Date(dateValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
})
const daysUntilExam = computed(() => {
  if (!nextExamDate.value) return null
  return Math.max(0, differenceInCalendarDays(nextExamDate.value, new Date()))
})
const nextExamDateText = computed(() =>
  nextExamDate.value ? format(nextExamDate.value, 'yyyy年M月d日') : '',
)
</script>

<template>
  <section class="overflow-hidden rounded-2xl border border-base-200 bg-base-100">
    <div class="px-4 py-4">
      <div class="flex min-w-0 items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="flex min-w-0 items-center gap-2">
            <h2 class="truncate text-lg font-semibold">{{ plan.majorName }}</h2>
            <span
              v-if="plan.educationLevel"
              class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
            >
              {{ plan.educationLevel }}
            </span>
          </div>
          <p v-if="planProvinceName || plan.majorCode" class="mt-1.5 text-xs text-base-content/65">
            <template v-if="planProvinceName">{{ planProvinceName }}</template>
            <template v-if="planProvinceName && plan.majorCode"> · </template>
            <template v-if="plan.majorCode">专业代码 {{ plan.majorCode }}</template>
          </p>
        </div>
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary"
        >
          <GraduationCap :size="17" />
        </span>
      </div>

      <div
        v-if="nextExamDate"
        class="mt-4 grid grid-cols-2 overflow-hidden rounded-xl bg-base-200/40"
      >
        <div class="border-r border-base-200 px-3 py-2.5">
          <p class="flex items-center gap-1.5 text-[11px] text-base-content/65">
            <span class="size-1.5 rounded-full bg-info"></span>
            考试时间
          </p>
          <p class="mt-1.5 text-sm font-semibold tabular-nums">{{ nextExamDateText }}</p>
        </div>
        <div class="px-3 py-2.5 text-right">
          <p class="flex items-center justify-end gap-1.5 text-[11px] text-base-content/65">
            <span class="size-1.5 rounded-full bg-primary"></span>
            距离考试
          </p>
          <p class="mt-0.5 text-sm text-base-content/60">
            <strong class="text-lg font-semibold text-primary tabular-nums">
              {{ daysUntilExam }}
            </strong>
            天
          </p>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-2 divide-x divide-base-200 border-t border-base-200">
      <button
        class="flex h-10 items-center justify-center gap-1.5 text-xs font-medium text-base-content/60 transition active:bg-base-200/50"
        type="button"
        aria-label="刷题计划"
        @click="emit('edit-plan')"
      >
        <ClipboardList :size="15" />
        刷题计划
      </button>
      <button
        class="flex h-10 items-center justify-center gap-1.5 text-xs font-medium text-base-content/60 transition active:bg-base-200/50"
        type="button"
        aria-label="刷题设置"
        @click="emit('edit-settings')"
      >
        <Settings2 :size="15" />
        刷题设置
      </button>
    </div>
  </section>
</template>
