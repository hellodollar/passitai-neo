<script setup lang="ts">
import { computed } from 'vue'

import BasePopup from '@/components/common/BasePopup.vue'
import { RESULT_STATUS_LABELS } from '@/constants/practice'
import { questionTypeLabels } from '@/generated/domain-values'
import type { PracticeResultQuestion } from '@/types'

const selectedQuestion = defineModel<PracticeResultQuestion | null>({ default: null })
const detailOpen = computed({
  get: () => selectedQuestion.value !== null,
  set: (open: boolean) => {
    if (!open) selectedQuestion.value = null
  },
})
</script>

<template>
  <BasePopup v-model="detailOpen" title="题目详情">
    <template v-if="selectedQuestion">
      <div class="flex items-center justify-between gap-3">
        <span class="text-xs leading-snug text-base-content/55">
          第 {{ selectedQuestion.index }} 题 ·
          {{ questionTypeLabels[selectedQuestion.questionType] }}
        </span>
        <span
          class="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
          :class="{
            'bg-success/10 text-success': selectedQuestion.status === 'correct',
            'bg-error/10 text-error': selectedQuestion.status === 'wrong',
            'bg-base-200/75 text-base-content/55 dark:bg-base-300/50':
              selectedQuestion.status === 'unanswered',
            'bg-secondary/10 text-secondary': selectedQuestion.status === 'pending',
            'bg-primary/10 text-primary': selectedQuestion.status === 'graded',
          }"
        >
          {{ RESULT_STATUS_LABELS[selectedQuestion.status] }}
        </span>
      </div>

      <h3
        class="mt-3 whitespace-pre-line break-words text-sm font-medium leading-relaxed text-base-content"
      >
        {{ selectedQuestion.title }}
      </h3>

      <dl
        class="mt-4 divide-y divide-base-content/[0.06] overflow-hidden rounded-xl bg-base-200/65 dark:divide-base-content/[0.08] dark:bg-base-300/45"
      >
        <div class="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-3 px-3.5 py-2.5">
          <dt class="text-xs text-base-content/55">我的答案</dt>
          <dd
            class="min-w-0 whitespace-pre-wrap break-words text-sm font-medium"
            :class="selectedQuestion.status === 'wrong' ? 'text-error' : 'text-base-content'"
          >
            {{ selectedQuestion.userAnswer || '未作答' }}
          </dd>
        </div>
        <div class="grid grid-cols-[5rem_minmax(0,1fr)] items-baseline gap-3 px-3.5 py-2.5">
          <dt class="text-xs text-base-content/55">正确答案</dt>
          <dd class="min-w-0 whitespace-pre-wrap break-words text-sm font-medium text-success">
            {{ selectedQuestion.correctAnswer || '待批阅' }}
          </dd>
        </div>
      </dl>

      <div class="mt-4 border-t border-base-content/[0.06] pt-3.5 dark:border-base-content/[0.08]">
        <h4 class="text-sm font-semibold text-base-content">题目解析</h4>
        <p
          v-if="selectedQuestion.explanation"
          class="mt-1.5 whitespace-pre-line break-words text-sm leading-relaxed text-base-content/70"
        >
          {{ selectedQuestion.explanation }}
        </p>
        <p v-else class="mt-1.5 text-xs leading-snug text-base-content/55">暂无解析</p>
      </div>
    </template>
  </BasePopup>
</template>
