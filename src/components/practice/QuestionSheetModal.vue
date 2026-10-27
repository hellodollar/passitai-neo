<script setup lang="ts">
import { Trash2 } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'

import type { PracticeAnswerRecord, QuestionListItem } from '@/types'
import type { QuestionSheetGroup } from '@/utils/practice/paper'
import {
  getReferenceAnswer,
  isAnswerCorrect,
  isChoiceQuestionType,
} from '@/utils/practice/question'

/** 答题卡：完整题号按题型连续展示，仅题号区滚动。 */
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
  /** 真实题集提供清除记录，收藏/错题练习不显示 */
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
const contentRef = ref<HTMLElement | null>(null)
let previousBodyOverflow = ''
let previousFocus: HTMLElement | null = null
let bodyLocked = false

const unansweredCount = computed(() => Math.max(0, props.questions.length - props.answeredCount))
const ungradedCount = computed(() =>
  Math.max(0, props.answeredCount - props.correctCount - props.wrongCount),
)
const visibleGroups = computed(() => props.groups.filter((group) => group.questions.length > 0))

function questionResultLabel(question: QuestionListItem) {
  const record = props.answerRecords[question.id]
  if (!record) return '未答'
  if (!isChoiceQuestionType(question.questionType) || !getReferenceAnswer(question)) return '已答'
  return isAnswerCorrect(record, question) ? '正确' : '错误'
}

function questionResultClasses(question: QuestionListItem) {
  const record = props.answerRecords[question.id]
  if (!record) return 'border-base-300 bg-base-100 text-base-content/70'
  if (!isChoiceQuestionType(question.questionType) || !getReferenceAnswer(question)) {
    return 'border-secondary/30 bg-secondary/10 text-secondary'
  }

  return isAnswerCorrect(record, question)
    ? 'border-success bg-success text-white font-semibold'
    : 'border-error bg-error text-white font-semibold'
}

watch(
  model,
  async (open) => {
    if (!open) {
      if (!bodyLocked) return
      document.body.style.overflow = previousBodyOverflow
      bodyLocked = false
      if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true })
      previousFocus = null
      return
    }
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    previousBodyOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    bodyLocked = true
    await nextTick()
    sheetRef.value?.focus({ preventScroll: true })
    const content = contentRef.value
    const current = content?.querySelector<HTMLElement>('[aria-current="step"]')
    if (content && current) {
      // 只调整题号区，避免 scrollIntoView 连带滚动被遮罩的作答页。
      const currentRect = current.getBoundingClientRect()
      const contentRect = content.getBoundingClientRect()
      content.scrollTop = Math.max(
        0,
        currentRect.top - contentRect.top - (content.clientHeight - currentRect.height) / 2,
      )
    }
  },
  { immediate: true },
)

function handleTab(event: KeyboardEvent) {
  const buttons = sheetRef.value?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')
  const first = buttons?.[0]
  const last = buttons?.[buttons.length - 1]
  if (!first || !last) {
    event.preventDefault()
    return
  }
  if (
    event.shiftKey &&
    (document.activeElement === first || document.activeElement === sheetRef.value)
  ) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

onBeforeUnmount(() => {
  if (bodyLocked) document.body.style.overflow = previousBodyOverflow
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
        class="flex h-[min(65dvh,32rem)] w-full max-w-[32rem] flex-col overflow-hidden rounded-t-2xl border-t border-base-200 bg-base-100 sm:rounded-2xl sm:border"
        role="dialog"
        aria-modal="true"
        aria-label="答题进度"
        tabindex="-1"
        @keydown.esc.stop.prevent="model = false"
        @keydown.tab="handleTab"
      >
        <!-- 状态图例：不带可见标题，弹层命名交给 aria-label；右侧放清除记录的安静入口 -->
        <div
          class="flex min-h-12 shrink-0 items-center gap-2 border-b border-base-200/70 px-4 py-2 text-xs tabular-nums text-base-content/65"
        >
          <div class="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1">
            <span class="flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-success" aria-hidden="true"></span>
              对 {{ correctCount }}
            </span>
            <span class="flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-error" aria-hidden="true"></span>
              错 {{ wrongCount }}
            </span>
            <span v-if="ungradedCount" class="flex items-center gap-1">
              <span class="size-1.5 rounded-full bg-secondary" aria-hidden="true"></span>
              已答 {{ ungradedCount }}
            </span>
            <span class="flex items-center gap-1">
              <span class="size-1.5 rounded-full border border-base-300" aria-hidden="true"></span>
              未答 {{ unansweredCount }}
            </span>
          </div>
          <button
            v-if="showClear"
            class="flex h-8 shrink-0 items-center gap-1 rounded-md pl-2 text-xs font-medium text-base-content/65 transition-colors hover:text-error active:text-error disabled:pointer-events-none disabled:opacity-40"
            type="button"
            aria-label="清除本地做题记录"
            :disabled="clearDisabled"
            @click="emit('clear')"
          >
            <Trash2 :size="14" />
            清除记录
          </button>
        </div>

        <div
          ref="contentRef"
          class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-3"
          :class="!showSubmit ? 'pb-[calc(0.75rem+env(safe-area-inset-bottom))]' : ''"
        >
          <section v-for="group in visibleGroups" :key="group.key" :aria-label="group.label">
            <p class="mb-1.5 text-[11px] font-medium text-base-content/65">
              {{ group.label }} · {{ group.questions.length }}题
            </p>
            <div
              class="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] justify-items-center gap-x-1 gap-y-1.5"
            >
              <button
                v-for="(question, offset) in group.questions"
                :key="group.startIndex + offset"
                class="flex size-7 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition-colors active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                :class="[
                  questionResultClasses(question),
                  currentIndex === group.startIndex + offset
                    ? 'outline-2 outline-offset-1 outline-primary'
                    : '',
                ]"
                type="button"
                :aria-label="`第 ${group.startIndex + offset + 1} 题，${questionResultLabel(question)}`"
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
          class="shrink-0 border-t border-base-200/80 px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2.5 sm:pb-3"
        >
          <button
            class="btn btn-primary h-10 min-h-10 w-full rounded-xl text-sm"
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
