<script setup lang="ts">
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  ListChecks,
  Settings,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseModal from '@/components/common/BaseModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PracticeSettingsContent from '@/components/common/PracticeSettingsContent.vue'
import { useAppStore } from '@/stores/app'
import { fetchPapers } from '@/api/papers'
import { fetchQuestions } from '@/api/questions'
import type { PaperListItem, QuestionListItem, QuestionType } from '@/types/domain'

const router = useRouter()
const app = useAppStore()

type RawQuestionOption = string | {
  id?: string
  value?: string
  label?: string
  text?: string
  content?: string
  title?: string
  name?: string
}

type NormalizedQuestionOption = {
  label: string
  text: string
  value: string
}

type RichQuestionListItem = QuestionListItem & {
  options?: RawQuestionOption[]
  choices?: RawQuestionOption[]
  optionList?: RawQuestionOption[]
  optionA?: string
  optionB?: string
  optionC?: string
  optionD?: string
  optionE?: string
  optionF?: string
  optionG?: string
  optionH?: string
  option1?: string
  option2?: string
  option3?: string
  option4?: string
  option5?: string
  option6?: string
  option7?: string
  option8?: string
  answer?: string | string[]
  correctAnswer?: string | string[]
  referenceAnswer?: string | string[]
  analysis?: string
  explanation?: string
}

type ParsedQuestionTitle = {
  title: string
  options: NormalizedQuestionOption[]
}

type PracticeAnswerRecord = {
  questionId: string
  text: string
  values: string[]
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const settingsModalOpen = ref(false)
const questionSheetOpen = ref(false)
const sessionPapers = ref<PaperListItem[]>([])

const currentQuestions = ref<QuestionListItem[]>([])
const currentIndex = ref(0)
const selectedOptionValues = ref<Set<string>>(new Set())
const textAnswer = ref('')
const answerRecords = ref<Record<string, PracticeAnswerRecord>>({})
const favoriteQuestionIds = ref<Set<string>>(new Set())
const touchStartX = ref(0)
const touchStartY = ref(0)
const autoAdvanceTimer = ref<ReturnType<typeof window.setTimeout> | null>(null)
const loading = ref(false)

const currentQuestion = computed(() => currentQuestions.value[currentIndex.value])
const parsedQuestionTitle = computed(() => parseQuestionTitle(currentQuestion.value))
const displayQuestionTitle = computed(() => parsedQuestionTitle.value.title)
const currentQuestionOptions = computed(() => getQuestionOptions(currentQuestion.value))
const resolvedQuestionOptions = computed(() => {
  if (currentQuestionOptions.value.length > 0) return currentQuestionOptions.value
  return getPreviewOptions(currentQuestion.value?.questionType)
})
const currentSessionTitle = computed(() => {
  if (sessionPapers.value.length === 0) return '练习'
  if (sessionPapers.value.length === 1) return sessionPapers.value[0]!.name
  return `${sessionPapers.value[0]!.name} 等 ${sessionPapers.value.length} 套`
})
const expectsChoiceQuestion = computed(() =>
  currentQuestion.value
    ? ['judge', 'multiple', 'single'].includes(currentQuestion.value.questionType)
    : false,
)
const isChoiceMode = computed(() => resolvedQuestionOptions.value.length > 0)
const isMultipleQuestion = computed(() => currentQuestion.value?.questionType === 'multiple')
const currentAnswerRecord = computed(() =>
  currentQuestion.value ? answerRecords.value[currentQuestion.value.id] : undefined,
)
const answeredCount = computed(() => Object.keys(answerRecords.value).length)
const currentQuestionPosition = computed(() =>
  currentQuestions.value.length === 0 ? 0 : currentIndex.value + 1,
)
const currentQuestionFavorited = computed(() =>
  currentQuestion.value ? favoriteQuestionIds.value.has(currentQuestion.value.id) : false,
)
const canSubmitCurrentAnswer = computed(() => {
  if (currentAnswerRecord.value) return false
  if (isChoiceMode.value) return selectedOptionValues.value.size > 0
  if (expectsChoiceQuestion.value) return false
  return textAnswer.value.trim().length > 0
})
const correctCount = computed(() => {
  let count = 0
  for (const record of Object.values(answerRecords.value)) {
    const question = currentQuestions.value.find((q) => q.id === record.questionId)
    if (question && isAnswerCorrect(record, question)) count++
  }
  return count
})
const wrongCount = computed(() => answeredCount.value - correctCount.value)
const progress = computed(() => {
  const total = currentQuestions.value.length || 1
  return ((currentIndex.value + 1) / total) * 100
})

function parseOptionLine(line: string): NormalizedQuestionOption | null {
  const match = line.trim().match(/^([A-Ha-h])\s*[.\u3001)\uff09:：]\s*(.+)$/)
  if (!match?.[1] || !match?.[2]?.trim()) return null

  const label = match[1].toUpperCase()
  return {
    label,
    text: match[2].trim(),
    value: label,
  }
}

function uniqueOptions(options: NormalizedQuestionOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = option.value || option.label
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function getPreviewOptions(questionType: QuestionType | undefined): NormalizedQuestionOption[] {
  if (questionType === 'judge') {
    return [
      { label: 'A', text: '正确', value: 'A' },
      { label: 'B', text: '错误', value: 'B' },
    ]
  }

  if (questionType === 'single' || questionType === 'multiple') {
    return ['选项 A', '选项 B', '选项 C', '选项 D'].map((text, index) => {
      const label = OPTION_LETTERS[index]!
      return { label, text, value: label }
    })
  }

  return []
}

function parseQuestionTitle(question: QuestionListItem | undefined): ParsedQuestionTitle {
  const title = question?.title.trim() ?? ''
  if (!title) return { title: '', options: [] }

  const lines = title.split(/\r?\n/)
  const parsedOptions = uniqueOptions(
    lines
      .map((line) => parseOptionLine(line))
      .filter((option): option is NormalizedQuestionOption => Boolean(option)),
  )

  if (parsedOptions.length < 2) {
    return { title, options: [] }
  }

  const firstOptionIndex = lines.findIndex((line) => Boolean(parseOptionLine(line)))
  const titleLines = firstOptionIndex >= 0 ? lines.slice(0, firstOptionIndex) : lines
  return {
    title: titleLines.join('\n').trim() || title,
    options: parsedOptions,
  }
}

function normalizeOption(option: RawQuestionOption, index: number): NormalizedQuestionOption | null {
  const fallbackLabel = OPTION_LETTERS[index] ?? String(index + 1)

  if (typeof option === 'string') {
    const parsedOption = parseOptionLine(option)
    if (parsedOption) return parsedOption

    return {
      label: fallbackLabel,
      text: option.trim(),
      value: fallbackLabel,
    }
  }

  const rawText = String(option.text ?? option.content ?? option.title ?? option.name ?? option.value ?? '')
  const parsedText = parseOptionLine(rawText)
  const label = option.label ? String(option.label).trim() : (parsedText?.label ?? fallbackLabel)
  const value = String(option.value ?? option.id ?? label)
  const text = parsedText && !option.label ? parsedText.text : rawText.trim()

  if (!text.trim()) return null

  return { label, text, value }
}

function getQuestionOptions(question: QuestionListItem | undefined) {
  if (!question) return []

  const richQuestion = question as RichQuestionListItem
  const listedOptions = richQuestion.options ?? richQuestion.choices ?? richQuestion.optionList

  if (Array.isArray(listedOptions)) {
    const options = listedOptions
      .map((option, index) => normalizeOption(option, index))
      .filter((option): option is NormalizedQuestionOption => Boolean(option))
    if (options.length > 0) return uniqueOptions(options)
  }

  const letterOptions = [
    richQuestion.optionA,
    richQuestion.optionB,
    richQuestion.optionC,
    richQuestion.optionD,
    richQuestion.optionE,
    richQuestion.optionF,
    richQuestion.optionG,
    richQuestion.optionH,
  ]
    .map((option, index) => option ? normalizeOption(option, index) : null)
    .filter((option): option is NormalizedQuestionOption => Boolean(option))

  if (letterOptions.length > 0) return uniqueOptions(letterOptions)

  const numberOptions = [
    richQuestion.option1,
    richQuestion.option2,
    richQuestion.option3,
    richQuestion.option4,
    richQuestion.option5,
    richQuestion.option6,
    richQuestion.option7,
    richQuestion.option8,
  ]
    .map((option, index) => option ? normalizeOption(option, index) : null)
    .filter((option): option is NormalizedQuestionOption => Boolean(option))

  if (numberOptions.length > 0) return uniqueOptions(numberOptions)

  return parsedQuestionTitle.value.options
}

function formatAnswerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.join('、')
  return value ?? ''
}

function getReferenceAnswer(question: QuestionListItem | undefined) {
  if (!question) return ''
  const richQuestion = question as RichQuestionListItem
  return formatAnswerValue(richQuestion.correctAnswer ?? richQuestion.referenceAnswer ?? richQuestion.answer)
}

function isAnswerCorrect(record: PracticeAnswerRecord, question: QuestionListItem) {
  const reference = getReferenceAnswer(question).toUpperCase()
  if (!reference) return false

  const expected = reference
    .split(/[\s,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .sort()
    .join(',')

  const actual = record.values
    .map((value) => value.toUpperCase())
    .sort()
    .join(',')

  return actual === expected
}

function syncCurrentDraft() {
  const question = currentQuestion.value
  if (!question) {
    selectedOptionValues.value = new Set()
    textAnswer.value = ''
    return
  }

  const record = answerRecords.value[question.id]
  selectedOptionValues.value = new Set(record?.values ?? [])
  textAnswer.value = record?.text ?? ''
}

function optionSelected(optionValue: string) {
  return selectedOptionValues.value.has(optionValue)
}

function toggleOption(optionValue: string) {
  if (currentAnswerRecord.value) return

  const nextValues = new Set(selectedOptionValues.value)

  if (isMultipleQuestion.value) {
    if (nextValues.has(optionValue)) {
      nextValues.delete(optionValue)
    } else {
      nextValues.add(optionValue)
    }
  } else {
    nextValues.clear()
    nextValues.add(optionValue)
  }

  selectedOptionValues.value = nextValues

  if (!isMultipleQuestion.value) {
    submitCurrentAnswer(true)
  }
}

function submitCurrentAnswer(autoAdvance = false) {
  const question = currentQuestion.value
  if (!question || !canSubmitCurrentAnswer.value) return

  const values = [...selectedOptionValues.value]
  const selectedLabels = resolvedQuestionOptions.value
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)

  answerRecords.value = {
    ...answerRecords.value,
    [question.id]: {
      questionId: question.id,
      text: isChoiceMode.value ? selectedLabels.join('、') : textAnswer.value.trim(),
      values,
    },
  }

  if (autoAdvance) {
    scheduleAutoAdvance()
  }
}

function editCurrentAnswer() {
  const question = currentQuestion.value
  if (!question) return

  clearAutoAdvance()
  const nextRecords = { ...answerRecords.value }
  delete nextRecords[question.id]
  answerRecords.value = nextRecords
}

function goToQuestion(index: number) {
  if (index < 0 || index >= currentQuestions.value.length) return
  clearAutoAdvance()
  currentIndex.value = index
  questionSheetOpen.value = false
}

function clearAutoAdvance() {
  if (autoAdvanceTimer.value) {
    window.clearTimeout(autoAdvanceTimer.value)
    autoAdvanceTimer.value = null
  }
}

function scheduleAutoAdvance() {
  clearAutoAdvance()

  if (currentIndex.value >= currentQuestions.value.length - 1) return

  autoAdvanceTimer.value = window.setTimeout(() => {
    nextQuestion()
    autoAdvanceTimer.value = null
  }, 260)
}

function toggleFavorite() {
  const question = currentQuestion.value
  if (!question) return

  const nextIds = new Set(favoriteQuestionIds.value)
  if (nextIds.has(question.id)) {
    nextIds.delete(question.id)
  } else {
    nextIds.add(question.id)
  }
  favoriteQuestionIds.value = nextIds
}

function handleTouchStart(event: TouchEvent) {
  const touch = event.touches[0]
  if (!touch) return
  touchStartX.value = touch.clientX
  touchStartY.value = touch.clientY
}

function handleTouchEnd(event: TouchEvent) {
  const touch = event.changedTouches[0]
  if (!touch) return

  const deltaX = touch.clientX - touchStartX.value
  const deltaY = touch.clientY - touchStartY.value

  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return

  if (deltaX < 0) {
    nextQuestion()
  } else {
    prevQuestion()
  }
}

function nextQuestion() {
  if (currentIndex.value < currentQuestions.value.length - 1) {
    clearAutoAdvance()
    currentIndex.value++
  }
}

function prevQuestion() {
  if (currentIndex.value > 0) {
    clearAutoAdvance()
    currentIndex.value--
  }
}

function exitSession() {
  app.endPracticeSession()
  router.push('/practice')
}

const QUESTION_TYPE_ORDER: Record<QuestionType, number> = {
  single: 0,
  multiple: 1,
  judge: 2,
  shortAnswer: 3,
  essay: 4,
}

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  shortAnswer: '简答题',
  essay: '论述题',
}

function compareQuestionType(a: QuestionListItem, b: QuestionListItem) {
  return (QUESTION_TYPE_ORDER[a.questionType] ?? 99) - (QUESTION_TYPE_ORDER[b.questionType] ?? 99)
}

const questionSheetGroups = computed(() => {
  const groups = new Map<QuestionType, { startIndex: number; questions: QuestionListItem[] }>()
  currentQuestions.value.forEach((question, index) => {
    if (!groups.has(question.questionType)) {
      groups.set(question.questionType, { startIndex: index, questions: [] })
    }
    groups.get(question.questionType)!.questions.push(question)
  })
  return [...groups.entries()].sort(
    (a, b) => (QUESTION_TYPE_ORDER[a[0]] ?? 99) - (QUESTION_TYPE_ORDER[b[0]] ?? 99),
  )
})

async function loadSessionData() {
  loading.value = true
  currentIndex.value = 0
  currentQuestions.value = []
  selectedOptionValues.value = new Set()
  textAnswer.value = ''
  answerRecords.value = {}

  const paperIds = app.practiceSessionPaperIds
  if (paperIds.length === 0) {
    loading.value = false
    return
  }

  try {
    const papersResult = await fetchPapers({ limit: 100 })
    sessionPapers.value = papersResult.items.filter((p) => paperIds.includes(p.id))

    const allQuestions: QuestionListItem[] = []
    for (const paperId of paperIds) {
      const result = await fetchQuestions({ paperId, limit: 100 })
      allQuestions.push(...result.items)
    }
    currentQuestions.value = allQuestions.sort(compareQuestionType)
  } catch {
    currentQuestions.value = []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadSessionData()
})

onBeforeUnmount(() => {
  app.endPracticeSession()
  clearAutoAdvance()
})

watch(
  () => currentQuestion.value?.id,
  () => {
    syncCurrentDraft()
  },
)
</script>

<template>
  <section class="flex w-full min-w-0 max-w-full flex-col gap-0 overflow-x-hidden">
    <header class="sticky top-0 z-30 -mx-5 border-b border-base-200 bg-base-100/96 px-4 pb-3 pt-[calc(0.35rem+env(safe-area-inset-top))] backdrop-blur">
      <div class="relative flex h-11 items-center justify-center">
        <button class="btn btn-square btn-ghost absolute left-0" type="button" aria-label="退出练习" @click="exitSession">
          <ArrowLeft :size="22" />
        </button>
        <h1 class="mx-12 truncate text-center text-base font-semibold leading-tight">{{ currentSessionTitle }}</h1>
      </div>
    </header>

    <div v-if="loading" class="-mx-5 py-24 text-center">
      <span class="loading loading-spinner loading-lg text-primary"></span>
    </div>

    <article
      v-else-if="currentQuestion"
      class="-mx-5 flex min-w-0 flex-col pb-[calc(5.25rem+env(safe-area-inset-bottom))]"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
    >
      <section class="min-w-0 px-5 pb-4 pt-2">
        <div class="max-h-48 min-h-24 overflow-y-auto">
          <h1 class="whitespace-pre-line break-words text-base font-normal leading-[1.7]">
            {{ displayQuestionTitle }}
          </h1>
        </div>
        <div class="mt-7 h-px bg-base-200"></div>
      </section>

      <section v-if="expectsChoiceQuestion" class="grid gap-2 px-5 pt-1">
        <button
          v-for="option in resolvedQuestionOptions"
          :key="option.value"
          class="flex min-w-0 items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left transition"
          :class="[
            optionSelected(option.value)
              ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
              : 'border-base-200 bg-base-100 text-base-content active:bg-base-200/70',
            currentAnswerRecord ? 'cursor-default' : '',
          ]"
          type="button"
          :aria-pressed="optionSelected(option.value)"
          @click="toggleOption(option.value)"
        >
          <span
            class="flex size-7 shrink-0 items-center justify-center border text-xs font-semibold"
            :class="[
              isMultipleQuestion ? 'rounded-xl' : 'rounded-full',
              optionSelected(option.value)
                ? 'border-primary bg-primary text-primary-content'
                : 'border-base-300 text-base-content/70',
            ]"
          >
            {{ option.label }}
          </span>
          <span class="min-w-0 flex-1 break-words text-sm leading-relaxed">{{ option.text }}</span>
        </button>

        <button
          v-if="isMultipleQuestion && !currentAnswerRecord"
          class="btn btn-primary mt-3 h-11 w-full rounded-full"
          type="button"
          :disabled="!canSubmitCurrentAnswer"
          @click="submitCurrentAnswer(true)"
        >
          确认答案
        </button>
      </section>

      <section v-else class="grid gap-3 px-5 pt-4">
        <textarea
          v-model="textAnswer"
          class="textarea min-h-[11rem] w-full resize-none rounded-2xl border-base-200 bg-base-200/55 p-4 text-base leading-relaxed focus:border-primary focus:outline-none"
          placeholder="输入答案"
          :disabled="Boolean(currentAnswerRecord)"
        ></textarea>

        <button
          v-if="!currentAnswerRecord"
          class="btn btn-primary h-11 w-full rounded-full"
          type="button"
          :disabled="!canSubmitCurrentAnswer"
          @click="submitCurrentAnswer(true)"
        >
          确认答案
        </button>
      </section>

      <section v-if="currentAnswerRecord" class="mx-5 mt-4 rounded-2xl border border-primary/15 bg-primary/5 px-3 py-2.5">
        <div class="flex items-center justify-between gap-3">
          <span class="inline-flex min-w-0 items-center gap-1.5 text-sm font-medium text-primary">
            <CheckCircle2 :size="17" />
            已作答
          </span>
          <button class="btn btn-ghost btn-xs h-7 min-h-0 px-2 text-base-content/60" type="button" @click="editCurrentAnswer">
            修改
          </button>
        </div>
        <p class="mt-1 break-words text-sm leading-relaxed text-base-content/65">
          你的答案：<span class="font-medium text-base-content">{{ currentAnswerRecord.text }}</span>
        </p>
      </section>
    </article>

    <div
      v-if="currentQuestion"
      class="fixed bottom-0 left-1/2 z-30 w-full max-w-[32rem] -translate-x-1/2 border-t border-base-200 bg-base-100/96 px-3 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur"
    >
      <div class="grid grid-cols-4 gap-1">
        <button class="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px]" type="button" @click="toggleFavorite">
          <Bookmark :size="21" :class="currentQuestionFavorited ? 'fill-primary text-primary' : 'text-base-content'" />
          <span :class="currentQuestionFavorited ? 'font-semibold text-primary' : 'text-base-content/65'">收藏</span>
        </button>
        <button class="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px]" type="button">
          <ClipboardCheck :size="21" class="text-base-content" />
          <span class="text-base-content/65">对{{ correctCount }}/错{{ wrongCount }}</span>
        </button>
        <button class="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px]" type="button" @click="questionSheetOpen = true">
          <ListChecks :size="21" class="text-base-content" />
          <span class="text-base-content/65">{{ currentQuestionPosition }}/{{ currentQuestions.length }}</span>
        </button>
        <button class="flex h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] text-base-content/65" type="button" @click="settingsModalOpen = true">
          <Settings :size="21" />
          <span>设置</span>
        </button>
      </div>
    </div>

    <EmptyState
      v-else
      :icon="ClipboardList"
      title="当前选择下暂无题目"
      description="返回后换一个练习包，或调整专业科目筛选。"
    />

    <BaseModal v-model="questionSheetOpen">
      <div class="mb-4 flex items-center justify-between text-sm text-base-content/60">
        <span>已完成 {{ answeredCount }}/{{ currentQuestions.length }}</span>
        <span>对 {{ correctCount }} / 错 {{ wrongCount }}</span>
      </div>
      <div class="grid max-h-96 gap-4 overflow-y-auto">
        <div v-for="[type, group] in questionSheetGroups" :key="type">
          <p class="mb-2 text-xs font-medium text-base-content/50">
            {{ QUESTION_TYPE_LABELS[type] }}（{{ group.questions.length }}题）
          </p>
          <div class="grid grid-cols-8 gap-2">
            <button
              v-for="(question, offset) in group.questions"
              :key="question.id"
              class="flex aspect-square items-center justify-center rounded-full border text-xs"
              :class="[
                group.startIndex + offset === currentIndex
                  ? 'border-primary bg-primary text-primary-content'
                  : answerRecords[question.id]
                    ? 'border-primary/20 bg-primary/10 text-primary'
                    : 'border-base-200 bg-base-100 text-base-content/70',
              ]"
              type="button"
              @click="goToQuestion(group.startIndex + offset)"
            >
              {{ group.startIndex + offset + 1 }}
            </button>
          </div>
        </div>
      </div>
    </BaseModal>

    <BaseModal v-model="settingsModalOpen">
      <PracticeSettingsContent />
    </BaseModal>
  </section>
</template>
