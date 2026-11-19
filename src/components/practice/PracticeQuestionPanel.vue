<script setup lang="ts">
import { CircleCheck, CircleX, ClipboardCheck } from '@lucide/vue'
import { computed } from 'vue'

import { questionTypeLabels } from '@/generated/domain-values'
import type { PracticeAnswerRecord, QuestionListItem } from '@/types'
import {
  getCorrectOptionValues,
  getPreviewOptions,
  getQuestionOptions,
  isAnswerCorrect,
  isChoiceQuestionType,
  parseQuestionTitle,
  type NormalizedQuestionOption,
} from '@/utils/practice/question'

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
const typeLabel = computed(() => questionTypeLabels[props.question.questionType])
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
      ? 'border-primary/40 bg-primary/10 text-base-content dark:bg-primary/15'
      : 'border-transparent bg-base-200/65 text-base-content active:bg-base-200 dark:bg-base-200/85 dark:active:bg-base-300/60'
  }

  if (optionIsCorrect(optionValue)) {
    return 'border-success/35 bg-success/10 text-base-content dark:bg-success/15'
  }

  if (selected) {
    return 'border-error/35 bg-error/10 text-base-content dark:bg-error/15'
  }

  return 'border-transparent bg-base-200/40 text-base-content/55 dark:bg-base-200/45'
}

function optionMarkerClasses(optionValue: string) {
  const selected = optionSelected(optionValue)

  if (!showOptionFeedback.value) {
    return selected
      ? 'bg-primary text-primary-content'
      : 'bg-base-100 text-base-content/70 dark:bg-base-300/70'
  }

  if (optionIsCorrect(optionValue)) {
    return selected ? 'bg-success text-success-content' : 'bg-success/15 text-success'
  }

  if (selected) {
    return 'bg-error text-error-content'
  }

  return 'bg-base-100/70 text-base-content/40 dark:bg-base-300/40'
}
</script>

<template>
  <section class="min-w-0 px-4 pt-3.5">
    <div class="flex items-center justify-between gap-3">
      <span
        class="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-medium leading-tight text-primary"
      >
        {{ typeLabel }}
      </span>
      <span
        v-if="subjectName"
        class="min-w-0 flex-1 truncate text-right text-xs leading-snug text-base-content/55"
      >
        {{ subjectName }}
      </span>
    </div>

    <h2
      class="mt-2.5 whitespace-pre-line break-words text-base font-medium leading-[1.6] text-base-content"
    >
      {{ displayTitle }}
    </h2>
  </section>

  <section v-if="expectsChoiceQuestion" class="px-4 pt-3.5">
    <div
      class="grid gap-2"
      :class="question.questionType === 'judge' ? 'grid-cols-2 gap-2.5' : 'grid-cols-1'"
    >
      <button
        v-for="option in resolvedOptions"
        :key="option.value"
        class="group flex min-h-[2.875rem] min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left transition-colors"
        :class="[optionClasses(option.value), answerRecord ? 'cursor-default' : '']"
        type="button"
        :aria-pressed="optionSelected(option.value)"
        @click="emit('toggle-option', option.value)"
      >
        <span
          class="flex size-6 shrink-0 items-center justify-center text-xs font-semibold transition-colors"
          :class="[
            isMultipleQuestion ? 'rounded-lg' : 'rounded-full',
            optionMarkerClasses(option.value),
          ]"
        >
          {{ option.label }}
        </span>
        <span class="min-w-0 flex-1 break-words text-sm leading-6">{{ option.text }}</span>
        <CircleCheck
          v-if="showOptionFeedback && optionIsCorrect(option.value)"
          :size="16"
          class="mt-1 shrink-0 text-success"
          aria-hidden="true"
        />
        <CircleX
          v-else-if="showOptionFeedback && optionSelected(option.value)"
          :size="16"
          class="mt-1 shrink-0 text-error"
          aria-hidden="true"
        />
      </button>
    </div>

    <button
      v-if="isMultipleQuestion && !answerRecord"
      class="btn btn-primary mt-3 h-10 min-h-10 w-full rounded-xl text-sm font-medium"
      type="button"
      :disabled="!canSubmitAnswer"
      @click="emit('confirm-answer')"
    >
      确认答案
    </button>
  </section>

  <section v-else class="grid gap-2.5 px-4 pt-3.5">
    <textarea
      :value="textAnswer"
      class="textarea min-h-[9rem] w-full resize-none rounded-xl border border-transparent bg-base-200/65 p-3.5 text-sm leading-relaxed text-base-content placeholder:text-base-content/40 focus:border-primary/40 focus:bg-base-100 focus:outline-none dark:bg-base-200/85 dark:focus:bg-base-200"
      placeholder="在这里输入你的答案…"
      :disabled="Boolean(answerRecord)"
      @input="emit('update:textAnswer', ($event.target as HTMLTextAreaElement).value)"
    ></textarea>

    <button
      v-if="!answerRecord"
      class="btn btn-primary h-10 min-h-10 w-full rounded-xl text-sm font-medium"
      type="button"
      :disabled="!canSubmitAnswer"
      @click="emit('confirm-answer')"
    >
      确认答案
    </button>
  </section>

  <section
    v-if="answerRecord"
    class="mx-4 mt-4 space-y-3 border-t border-base-content/[0.06] pt-3.5 dark:border-base-content/[0.08]"
  >
    <div
      class="rounded-xl px-3.5 py-2.5"
      :class="
        !canGrade
          ? 'bg-base-200/65 dark:bg-base-300/45'
          : answerCorrect
            ? 'bg-success/10 dark:bg-success/15'
            : 'bg-error/10 dark:bg-error/15'
      "
      role="status"
    >
      <div
        class="flex items-center gap-1.5 text-sm font-semibold"
        :class="!canGrade ? 'text-base-content/70' : answerCorrect ? 'text-success' : 'text-error'"
      >
        <ClipboardCheck v-if="!canGrade" :size="16" />
        <CircleCheck v-else-if="answerCorrect" :size="16" />
        <CircleX v-else :size="16" />
        {{ !canGrade ? '已作答' : answerCorrect ? '回答正确' : '回答错误' }}
      </div>
      <dl
        class="mt-1.5 grid gap-x-3 gap-y-1 text-xs leading-snug"
        :class="isChoiceMode ? 'grid-cols-2' : 'grid-cols-1'"
      >
        <div class="min-w-0">
          <dt class="mr-1.5 inline text-base-content/55">我的答案</dt>
          <dd class="inline break-words font-semibold text-base-content">
            {{ userAnswerText || '—' }}
          </dd>
        </div>
        <div class="min-w-0">
          <dt class="mr-1.5 inline text-base-content/55">
            {{ isChoiceMode ? '正确答案' : '参考答案' }}
          </dt>
          <dd class="inline break-words font-semibold text-base-content">
            {{ correctAnswerText || '暂无' }}
          </dd>
        </div>
      </dl>
    </div>

    <div>
      <h3 class="text-sm font-semibold text-base-content">题目解析</h3>
      <p
        v-if="explanation"
        class="mt-1.5 whitespace-pre-line break-words text-sm leading-[1.65] text-base-content/70"
      >
        {{ explanation }}
      </p>
      <p v-else class="mt-1.5 text-xs leading-snug text-base-content/55">暂无解析</p>
    </div>
  </section>
</template>
