<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { PracticeAnswerRecord, QuestionListItem } from '@/types'
import type { QuestionSheetGroup } from '@/utils/practice-paper'
import {
  getReferenceAnswer,
  isAnswerCorrect,
  isChoiceQuestionType,
} from '@/utils/practice-question'
import {
  getQuestionSheetRanges,
  getVisibleQuestionSheetGroups,
  QUESTION_SHEET_RANGE_SIZE,
} from '@/utils/question-sheet'

/** 答题卡弹层：题号区间分页、作答状态图例与交卷、清除记录入口。 */
const props = defineProps<{
  questions: QuestionListItem[]
  groups: QuestionSheetGroup[]
  currentIndex: number
  answerRecords: Record<string, PracticeAnswerRecord>
  answeredCount: number
  correctCount: number
  wrongCount: number
  /** 收藏/错题纯刷题模式不显示交卷按钮 */
  showSubmit: boolean
  /** 仅专项训练显示清除本地记录入口 */
  showClear: boolean
  /** 无本地作答或交卷中时禁用清除 */
  clearDisabled: boolean
}>()

const emit = defineEmits<{
  select: [index: number]
  submit: []
  clear: []
}>()

const model = defineModel<boolean>({ default: false })

const sheetRef = ref<HTMLElement | null>(null)
const rangeNavRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const rangeIndex = ref(0)
let previousBodyOverflow = ''

const unansweredCount = computed(() => Math.max(0, props.questions.length - props.answeredCount))
const ranges = computed(() => getQuestionSheetRanges(props.questions.length))
const visibleGroups = computed(() =>
  getVisibleQuestionSheetGroups(props.groups, props.questions.length, rangeIndex.value),
)

function questionResultClasses(question: QuestionListItem) {
  const record = props.answerRecords[question.id]
  if (!record) return 'border-base-300 bg-base-100 text-base-content/70'
  if (!isChoiceQuestionType(question.questionType) || !getReferenceAnswer(question)) {
    return 'border-warning/40 bg-warning/10 text-warning font-semibold'
  }

  return isAnswerCorrect(record, question)
    ? 'border-success bg-success text-white font-semibold'
    : 'border-error bg-error text-white font-semibold'
}

watch(model, async (open) => {
  if (!open) {
    document.body.style.overflow = previousBodyOverflow
    return
  }
  rangeIndex.value = Math.floor(props.currentIndex / QUESTION_SHEET_RANGE_SIZE)
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  await nextTick()
  sheetRef.value?.focus()
  rangeNavRef.value
    ?.querySelector('[aria-pressed="true"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'center' })
})

watch(rangeIndex, () => {
  if (contentRef.value) contentRef.value.scrollTop = 0
})

onBeforeUnmount(() => {
  if (model.value) document.body.style.overflow = previousBodyOverflow
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="model"
      class="fixed inset-0 z-50 flex items-end justify-center bg-base-content/40 sm:items-center sm:px-4"
      @click.self="model = false"
    >
      <section
        ref="sheetRef"
        class="flex max-h-[min(78dvh,32rem)] w-full max-w-[32rem] flex-col overflow-hidden rounded-t-3xl border-t border-base-200 bg-base-100 sm:rounded-3xl sm:border"
        role="dialog"
        aria-modal="true"
        aria-label="答题进度"
        tabindex="-1"
        @keydown.esc="model = false"
      >
        <!-- 状态图例：不带可见标题，弹层命名交给 aria-label；右侧放清除记录的安静入口 -->
        <div
          class="flex shrink-0 items-center gap-4 border-b border-base-200/70 px-4 pb-2 pt-3 text-xs tabular-nums text-base-content/65"
        >
          <span class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-success"></span>
            对 {{ correctCount }}
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-2 rounded-full bg-error"></span>
            错 {{ wrongCount }}
          </span>
          <span class="flex items-center gap-1.5">
            <span class="size-2 rounded-full border border-base-300 bg-base-100"></span>
            未答 {{ unansweredCount }}
          </span>
          <button
            v-if="showClear"
            class="ml-auto flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-xs font-medium text-base-content/45 transition-colors hover:bg-error/5 hover:text-error active:bg-error/10 disabled:pointer-events-none disabled:opacity-35"
            type="button"
            aria-label="清除本地做题记录"
            :disabled="clearDisabled"
            @click="emit('clear')"
          >
            <Trash2 :size="14" />
            清除
          </button>
        </div>

        <div
          v-if="ranges.length > 1"
          ref="rangeNavRef"
          class="flex shrink-0 gap-1.5 overflow-x-auto border-b border-base-200/70 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="group"
          aria-label="题号区间"
        >
          <button
            v-for="range in ranges"
            :key="range.index"
            class="shrink-0 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums transition-colors"
            :class="
              rangeIndex === range.index
                ? 'bg-primary/10 text-primary'
                : 'text-base-content/65 active:bg-base-200'
            "
            type="button"
            :aria-label="`第 ${range.start + 1} 至 ${range.end} 题`"
            :aria-pressed="rangeIndex === range.index"
            @click="rangeIndex = range.index"
          >
            {{ range.label }}
          </button>
        </div>

        <div ref="contentRef" class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">
          <section v-for="group in visibleGroups" :key="group.key" class="pb-3">
            <p class="mb-2 text-xs font-medium text-base-content/65">
              {{ group.label }} · {{ group.questions.length }}题
            </p>
            <div
              class="grid grid-cols-8 justify-items-center gap-x-1 gap-y-2 min-[375px]:grid-cols-9 sm:grid-cols-10"
            >
              <button
                v-for="(question, offset) in group.questions"
                :key="group.startIndex + offset"
                class="flex size-8 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors active:opacity-70"
                :class="[
                  questionResultClasses(question),
                  currentIndex === group.startIndex + offset
                    ? 'ring-1 ring-primary/70 ring-offset-1 ring-offset-base-100'
                    : '',
                ]"
                type="button"
                :aria-label="`第 ${group.startIndex + offset + 1} 题`"
                :aria-current="currentIndex === group.startIndex + offset ? 'step' : undefined"
                @click="emit('select', group.startIndex + offset)"
              >
                {{ group.startIndex + offset + 1 }}
              </button>
            </div>
          </section>
        </div>

        <!-- 底部操作：仅交卷（收藏/错题纯刷题模式不显示） -->
        <div
          v-if="showSubmit"
          class="shrink-0 border-t border-base-200/80 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:pb-4"
        >
          <button
            class="btn btn-primary h-11 min-h-11 w-full rounded-xl text-sm"
            type="button"
            :disabled="questions.length === 0"
            @click="emit('submit')"
          >
            交卷
          </button>
        </div>
      </section>
    </div>
  </Teleport>
</template>
