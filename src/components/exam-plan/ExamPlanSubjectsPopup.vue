<script setup lang="ts">
import { ArrowDown, ArrowUp, GraduationCap } from '@lucide/vue'

import BasePopup from '@/components/common/BasePopup.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { ExamPlanSubject } from '@/types'

const model = defineModel<boolean>({ default: false })
defineProps<{
  subjects: ExamPlanSubject[]
  activeSubjectCode?: string
  hiddenSubjectCodes: ReadonlySet<string>
}>()
const emit = defineEmits<{
  select: [code: string]
  'toggle-visibility': [code: string]
  move: [code: string, direction: -1 | 1]
}>()
</script>

<template>
  <BasePopup v-model="model" title="科目管理">
    <p v-if="subjects.length > 0" class="mb-2.5 px-0.5 text-xs leading-snug text-base-content/55">
      勾选显示，使用箭头调整顺序
    </p>

    <div v-if="subjects.length > 0" class="grid gap-2">
      <div
        v-for="(subject, index) in subjects"
        :key="subject.code"
        class="flex min-w-0 items-center gap-2.5 rounded-xl border px-3.5 py-3 transition-colors"
        :class="[
          activeSubjectCode === subject.code && !hiddenSubjectCodes.has(subject.code)
            ? 'border-primary/40 bg-primary/10 dark:bg-primary/15'
            : 'border-transparent bg-base-200/65 dark:bg-base-300/45',
          hiddenSubjectCodes.has(subject.code) ? 'opacity-55' : '',
        ]"
      >
        <label class="flex size-7 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            class="checkbox checkbox-xs checkbox-primary"
            :checked="!hiddenSubjectCodes.has(subject.code)"
            :aria-label="`${subject.name}显示状态`"
            @change="emit('toggle-visibility', subject.code)"
          />
        </label>

        <button
          class="min-w-0 flex-1 text-left"
          :class="
            activeSubjectCode === subject.code && !hiddenSubjectCodes.has(subject.code)
              ? 'text-primary'
              : 'text-base-content'
          "
          type="button"
          @click="emit('select', subject.code)"
        >
          <span class="block truncate text-sm font-medium leading-snug">{{ subject.name }}</span>
          <span
            v-if="subject.code"
            class="mt-0.5 block truncate text-xs leading-snug tabular-nums text-base-content/55"
          >
            {{ subject.code }}
          </span>
        </button>

        <div class="flex shrink-0 items-center gap-1">
          <button
            class="flex size-8 items-center justify-center rounded-lg text-base-content/55 transition-colors active:bg-base-200 disabled:opacity-30 dark:active:bg-base-300/70"
            type="button"
            aria-label="上移科目"
            :disabled="index === 0"
            @click="emit('move', subject.code, -1)"
          >
            <ArrowUp :size="15" />
          </button>
          <button
            class="flex size-8 items-center justify-center rounded-lg text-base-content/55 transition-colors active:bg-base-200 disabled:opacity-30 dark:active:bg-base-300/70"
            type="button"
            aria-label="下移科目"
            :disabled="index === subjects.length - 1"
            @click="emit('move', subject.code, 1)"
          >
            <ArrowDown :size="15" />
          </button>
        </div>
      </div>
    </div>

    <EmptyState
      v-else
      :icon="GraduationCap"
      title="暂无可管理科目"
      description="请先在考试计划中选择科目"
      embedded
    />
  </BasePopup>
</template>
