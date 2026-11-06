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
        <span class="text-xs font-medium text-base-content/65">
          第 {{ selectedQuestion.index }} 题 ·
          {{ questionTypeLabels[selectedQuestion.questionType] }}
        </span>
        <span
          class="rounded-full px-2 py-1 text-[11px] font-semibold"
          :class="{
            'bg-success/10 text-success': selectedQuestion.status === 'correct',
            'bg-error/10 text-error': selectedQuestion.status === 'wrong',
            'bg-base-200 text-base-content/45': selectedQuestion.status === 'unanswered',
            'bg-secondary/10 text-secondary': selectedQuestion.status === 'pending',
          }"
        >
          {{ RESULT_STATUS_LABELS[selectedQuestion.status] }}
        </span>
      </div>

      <h3 class="mt-3 whitespace-pre-line break-words text-sm font-medium leading-6">
        {{ selectedQuestion.title }}
      </h3>

      <dl class="mt-4 overflow-hidden rounded-xl border border-base-200 divide-y divide-base-200">
        <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
          <dt class="text-base-content/65">我的答案</dt>
          <dd
            class="min-w-0 whitespace-pre-wrap break-words"
            :class="selectedQuestion.status === 'wrong' ? 'text-error' : ''"
          >
            {{ selectedQuestion.userAnswer || '未作答' }}
          </dd>
        </div>
        <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
          <dt class="text-base-content/65">正确答案</dt>
          <dd class="min-w-0 whitespace-pre-wrap break-words text-success">
            {{ selectedQuestion.correctAnswer || '待批阅' }}
          </dd>
        </div>
      </dl>

      <div class="mt-4 border-t border-base-200 pt-3">
        <h4 class="text-sm font-semibold">题目解析</h4>
        <p class="mt-1.5 whitespace-pre-line break-words text-sm leading-6 text-base-content/60">
          {{ selectedQuestion.explanation || '暂无解析' }}
        </p>
      </div>
    </template>
  </BasePopup>
</template>
