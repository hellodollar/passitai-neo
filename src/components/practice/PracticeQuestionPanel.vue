<script setup lang="ts">
import { CheckCircle2, ClipboardCheck, XCircle } from '@lucide/vue'
import { computed } from 'vue'

import { QUESTION_TYPE_LABELS } from '@/constants/entity'
import type { PracticeAnswerRecord, QuestionListItem } from '@/types'
import {
  getCorrectOptionValues,
  getPreviewOptions,
  getQuestionOptions,
  isAnswerCorrect,
  isChoiceQuestionType,
  parseQuestionTitle,
  type NormalizedQuestionOption,
} from '@/utils/practice-question'

/** 单题作答面板：题干与选项渲染、主观题输入、答后反馈与解析展示。 */
const props = defineProps<{
  question: QuestionListItem
  subjectName: string
  selectedValues: Set<string>
  textAnswer: string
  /** 已确认的作答记录；未作答时为 undefined */
  answerRecord?: PracticeAnswerRecord
}>()

const emit = defineEmits<{
  'toggle-option': [value: string]
  'confirm-answer': []
  'update:textAnswer': [value: string]
}>()

const expectsChoiceQuestion = computed(() => isChoiceQuestionType(props.question.questionType))
const isMultipleQuestion = computed(() => props.question.questionType === 'multiple')
const typeLabel = computed(() => QUESTION_TYPE_LABELS[props.question.questionType])
const displayTitle = computed(() => parseQuestionTitle(props.question).title)

const resolvedOptions = computed<NormalizedQuestionOption[]>(() => {
  const options = getQuestionOptions(props.question)
  return options.length > 0 ? options : getPreviewOptions(props.question.questionType)
})
const isChoiceMode = computed(() => resolvedOptions.value.length > 0)

const correctOptionValues = computed(
  () => new Set(getCorrectOptionValues(props.question, resolvedOptions.value)),
)
const showOptionFeedback = computed(
  () => Boolean(props.answerRecord) && correctOptionValues.value.size > 0,
)
const answerCorrect = computed(() =>
  Boolean(props.answerRecord && isAnswerCorrect(props.answerRecord, props.question)),
)
const canGrade = computed(() => isChoiceMode.value && correctOptionValues.value.size > 0)

/** 横幅里的正确答案文案:选择题取选项字母,其余取参考答案 */
const correctAnswerText = computed(() => {
  if (correctOptionValues.value.size > 0) {
    return resolvedOptions.value
      .filter((option) => correctOptionValues.value.has(option.value))
      .map((option) => option.label)
      .join('、')
  }
  return props.question.correctAnswer
})
const userAnswerText = computed(() => {
  const record = props.answerRecord
  if (!record) return ''
  return record.text || record.values.join('、')
})
const explanation = computed(() => props.question.explanation ?? '')

const canSubmitAnswer = computed(() => {
  if (props.answerRecord) return false
  if (isChoiceMode.value) return props.selectedValues.size > 0
  if (expectsChoiceQuestion.value) return false
  return props.textAnswer.trim().length > 0
})

function optionSelected(optionValue: string) {
  return props.selectedValues.has(optionValue)
}

function optionIsCorrect(optionValue: string) {
  return correctOptionValues.value.has(optionValue)
}

function optionClasses(optionValue: string) {
  const selected = optionSelected(optionValue)

  if (!showOptionFeedback.value) {
    return selected
      ? 'border-primary bg-primary/[0.07] text-base-content'
      : 'border-base-200 bg-base-100 text-base-content active:border-base-300 active:bg-base-200/60'
  }

  if (optionIsCorrect(optionValue)) {
    return 'border-success bg-success/[0.06] text-base-content'
  }

  if (selected) {
    return 'border-error bg-error/[0.06] text-base-content'
  }

  return 'border-base-200 bg-base-100 text-base-content/55'
}

function optionMarkerClasses(optionValue: string) {
  const selected = optionSelected(optionValue)

  if (!showOptionFeedback.value) {
    return selected
      ? 'border-primary bg-primary text-primary-content'
      : 'border-base-300 bg-base-100 text-base-content/55'
  }

  if (optionIsCorrect(optionValue)) {
    return 'border-success bg-success/10 text-success'
  }

  if (selected) {
    return 'border-error bg-error/10 text-error'
  }

  return 'border-base-300 bg-base-100 text-base-content/40'
}
</script>

<template>
  <section class="min-w-0 px-5 pt-2">
    <div class="flex items-center justify-between gap-3">
      <span class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
        {{ typeLabel }}
      </span>
      <span
        v-if="subjectName"
        class="min-w-0 flex-1 truncate text-right text-xs font-medium text-base-content/65"
      >
        {{ subjectName }}
      </span>
    </div>

    <h2 class="mt-2 whitespace-pre-line break-words text-base font-medium leading-[1.45]">
      {{ displayTitle }}
    </h2>
  </section>

  <section v-if="expectsChoiceQuestion" class="px-5 pt-2.5">
    <div
      class="grid gap-1.5"
      :class="question.questionType === 'judge' ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <button
        v-for="option in resolvedOptions"
        :key="option.value"
        class="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition"
        :class="[optionClasses(option.value), answerRecord ? 'cursor-default' : '']"
        type="button"
        :aria-pressed="optionSelected(option.value)"
        @click="emit('toggle-option', option.value)"
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center border text-[11px] font-bold transition"
          :class="[
            isMultipleQuestion ? 'rounded-lg' : 'rounded-full',
            optionMarkerClasses(option.value),
          ]"
        >
          {{ option.label }}
        </span>
        <span class="min-w-0 flex-1 break-words text-[14px] leading-[1.4]">{{ option.text }}</span>
      </button>
    </div>

    <button
      v-if="isMultipleQuestion && !answerRecord"
      class="btn btn-primary mt-2.5 h-10 min-h-10 w-full rounded-xl text-sm"
      type="button"
      :disabled="!canSubmitAnswer"
      @click="emit('confirm-answer')"
    >
      确认答案
    </button>
  </section>

  <section v-else class="grid gap-3 px-5 pt-3">
    <textarea
      :value="textAnswer"
      class="textarea min-h-[10rem] w-full resize-none rounded-xl border-base-200 bg-base-200/45 p-3.5 text-[15px] leading-relaxed focus:border-primary focus:bg-base-100 focus:outline-none"
      placeholder="在这里输入你的答案…"
      :disabled="Boolean(answerRecord)"
      @input="emit('update:textAnswer', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>

    <button
      v-if="!answerRecord"
      class="btn btn-primary h-10 min-h-10 w-full rounded-xl text-sm"
      type="button"
      :disabled="!canSubmitAnswer"
      @click="emit('confirm-answer')"
    >
      确认答案
    </button>
  </section>

  <section v-if="answerRecord" class="mx-5 mt-3 space-y-3 border-t border-base-200 pt-2.5">
    <div
      class="rounded-lg border px-3 py-2.5"
      :class="
        !canGrade
          ? 'border-base-200 bg-base-200/40'
          : answerCorrect
            ? 'border-success/25 bg-success/[0.06]'
            : 'border-error/25 bg-error/[0.06]'
      "
      role="status"
    >
      <div
        class="flex items-center gap-1.5 text-sm font-semibold"
        :class="!canGrade ? 'text-base-content/70' : answerCorrect ? 'text-success' : 'text-error'"
      >
        <ClipboardCheck v-if="!canGrade" :size="16" />
        <CheckCircle2 v-else-if="answerCorrect" :size="16" />
        <XCircle v-else :size="16" />
        {{ !canGrade ? '已作答' : answerCorrect ? '回答正确' : '回答错误' }}
      </div>
      <dl
        class="mt-1.5 grid gap-x-3 gap-y-1 text-xs leading-5"
        :class="isChoiceMode ? 'grid-cols-2' : 'grid-cols-1'"
      >
        <div class="min-w-0">
          <dt class="inline text-base-content/65">我的答案</dt>
          <dd
            class="inline break-words font-semibold"
            :class="
              !canGrade ? 'text-base-content/80' : answerCorrect ? 'text-success' : 'text-error'
            "
          >
            {{ userAnswerText || '—' }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="inline text-base-content/65">
            {{ isChoiceMode ? '正确答案' : '参考答案' }}
          </dt>
          <dd
            class="inline break-words font-semibold"
            :class="isChoiceMode ? 'text-success' : 'text-base-content/80'"
          >
            {{ correctAnswerText || '暂无' }}
          </dd>
        </div>
      </dl>
    </div>

    <div>
      <h3 class="text-sm font-semibold text-base-content">题目解析</h3>
      <p v-if="explanation" class="mt-1.5 break-words text-sm leading-[1.55] text-base-content/65">
        {{ explanation }}
      </p>
      <p v-else class="mt-2 text-sm text-base-content/65">暂无解析</p>
    </div>
  </section>
</template>
