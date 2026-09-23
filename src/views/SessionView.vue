<script setup lang="ts">
import {
  ArrowLeft,
  Bookmark,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Grid2X2,
  Send,
  Settings,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseDialog from '@/components/common/BaseDialog.vue'
import BaseModal from '@/components/common/BaseModal.vue'
import PracticeSettingsContent from '@/components/common/PracticeSettingsContent.vue'
import { addFavorite, fetchFavorites, removeFavorite } from '@/api/favorites'
import { ROUTE_NAMES } from '@/constants/app'
import { QUESTION_TYPE_LABELS, QUESTION_TYPE_ORDER } from '@/constants/domain'
import { useAppStore } from '@/stores/app'
import { fetchPracticeAnswerSheet, submitPracticeSession } from '@/api/practice'
import type {
  PracticeAnswerSheetItem,
  PracticeSubmissionResult,
  PracticeSubmitResponse,
  QuestionListItem,
  QuestionType,
  SubmitPracticeSessionBody,
} from '@/types/domain'
import { writePracticeResultSnapshot } from '@/utils/practice-result'

const router = useRouter()
const route = useRoute()
const app = useAppStore()

type RawQuestionOption =
  | string
  | {
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

type SessionLoadState = 'loading' | 'ready' | 'missing' | 'empty' | 'error'

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

const settingsModalOpen = ref(false)
const questionSheetOpen = ref(false)
const submitConfirmOpen = ref(false)
const submitting = ref(false)
const submitError = ref('')
const sessionTitles = ref<string[]>([])
const sessionStartedAt = Date.now()

const currentQuestions = ref<QuestionListItem[]>([])
const currentIndex = ref(0)
const selectedOptionValues = ref<Set<string>>(new Set())
const textAnswer = ref('')
const answerRecords = ref<Record<string, PracticeAnswerRecord>>({})
const favoriteQuestionIds = ref<Set<string>>(new Set())
const pendingFavoriteQuestionIds = ref<Set<string>>(new Set())
const favoriteError = ref('')
const touchStartX = ref(0)
const touchStartY = ref(0)
const autoAdvanceTimer = ref<ReturnType<typeof window.setTimeout> | null>(null)
const sessionLoadState = ref<SessionLoadState>('loading')

const currentQuestion = computed(() => currentQuestions.value[currentIndex.value])
const parsedQuestionTitle = computed(() => parseQuestionTitle(currentQuestion.value))
const displayQuestionTitle = computed(() => parsedQuestionTitle.value.title)
const currentQuestionOptions = computed(() => getQuestionOptions(currentQuestion.value))
const resolvedQuestionOptions = computed(() => {
  if (currentQuestionOptions.value.length > 0) return currentQuestionOptions.value
  return getPreviewOptions(currentQuestion.value?.questionType)
})
const currentSessionTitle = computed(() => {
  if (sessionTitles.value.length === 0) return '练习'
  if (sessionTitles.value.length === 1) return sessionTitles.value[0]!
  return `${sessionTitles.value[0]!} 等 ${sessionTitles.value.length} 套`
})
const sessionSubjectName = computed(() => {
  const subject = route.query.subject
  return typeof subject === 'string' ? subject : ''
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
const currentExplanation = computed(
  () => (currentQuestion.value as RichQuestionListItem | undefined)?.explanation ?? '',
)
const correctOptionValues = computed(
  () => new Set(getCorrectOptionValues(currentQuestion.value, resolvedQuestionOptions.value)),
)
const showOptionFeedback = computed(
  () => Boolean(currentAnswerRecord.value) && correctOptionValues.value.size > 0,
)
const answeredCount = computed(() => Object.keys(answerRecords.value).length)
const unansweredCount = computed(() =>
  Math.max(0, currentQuestions.value.length - answeredCount.value),
)
const currentQuestionPosition = computed(() =>
  currentQuestions.value.length === 0 ? 0 : currentIndex.value + 1,
)
const currentQuestionFavorited = computed(() =>
  currentQuestion.value ? favoriteQuestionIds.value.has(currentQuestion.value.id) : false,
)
const currentQuestionFavoritePending = computed(() =>
  currentQuestion.value ? pendingFavoriteQuestionIds.value.has(currentQuestion.value.id) : false,
)
const currentQuestionTypeLabel = computed(() =>
  currentQuestion.value ? QUESTION_TYPE_LABELS[currentQuestion.value.questionType] : '',
)
const progressPercent = computed(() => {
  if (currentQuestions.value.length === 0) return 0
  return (currentQuestionPosition.value / currentQuestions.value.length) * 100
})
const sessionStateContent = computed(() => {
  if (sessionLoadState.value === 'error') {
    return {
      icon: CircleAlert,
      iconClasses: 'bg-error/10 text-error',
      title: '加载失败',
      description: '网络波动或题目异常，请重试。',
      primaryLabel: '重新加载',
      showSecondaryAction: true,
    }
  }

  if (sessionLoadState.value === 'missing') {
    return {
      icon: ClipboardList,
      iconClasses: 'bg-warning/15 text-warning',
      title: '练习已失效',
      description: '返回练习页重新选择即可继续。',
      primaryLabel: '返回练习',
      showSecondaryAction: false,
    }
  }

  return {
    icon: ClipboardList,
    iconClasses: 'bg-primary/10 text-primary',
    title: '暂无题目',
    description: '这个练习包没有题目，换一个试试。',
    primaryLabel: '更换练习包',
    showSecondaryAction: false,
  }
})
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

function normalizeOption(
  option: RawQuestionOption,
  index: number,
): NormalizedQuestionOption | null {
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

  const rawText = String(
    option.text ?? option.content ?? option.title ?? option.name ?? option.value ?? '',
  )
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
    .map((option, index) => (option ? normalizeOption(option, index) : null))
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
    .map((option, index) => (option ? normalizeOption(option, index) : null))
    .filter((option): option is NormalizedQuestionOption => Boolean(option))

  if (numberOptions.length > 0) return uniqueOptions(numberOptions)

  return parseQuestionTitle(question).options
}

function formatAnswerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.join('、')
  return value ?? ''
}

function parseChoiceAnswerValues(value: string | string[] | undefined) {
  const tokens = formatAnswerValue(value)
    .trim()
    .toUpperCase()
    .split(/[\s,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (tokens.length === 1 && /^[A-H]{2,8}$/.test(tokens[0]!)) {
    return [...tokens[0]!]
  }

  return tokens
}

function getReferenceAnswer(question: QuestionListItem | undefined) {
  if (!question) return ''
  const richQuestion = question as RichQuestionListItem
  return formatAnswerValue(
    richQuestion.correctAnswer ?? richQuestion.referenceAnswer ?? richQuestion.answer,
  )
}

function getCorrectOptionValues(
  question: QuestionListItem | undefined,
  options = getQuestionOptions(question),
) {
  if (!question) return []

  const expectedValues = new Set(parseChoiceAnswerValues(getReferenceAnswer(question)))
  const availableOptions = options.length > 0 ? options : getPreviewOptions(question.questionType)

  return availableOptions
    .filter((option) =>
      [option.value, option.label, option.text].some((value) =>
        expectedValues.has(value.trim().toUpperCase()),
      ),
    )
    .map((option) => option.value)
}

function isAnswerCorrect(record: PracticeAnswerRecord, question: QuestionListItem) {
  const reference = getReferenceAnswer(question).trim()
  if (!reference) return false

  const isChoice = ['single', 'multiple', 'judge'].includes(question.questionType)
  const expectedValues = isChoice ? getCorrectOptionValues(question) : [reference.toUpperCase()]
  const actualValues = isChoice
    ? parseChoiceAnswerValues(record.values)
    : [record.text.trim().toUpperCase()]

  const expected = expectedValues
    .map((value) => value.toUpperCase())
    .sort()
    .join(',')
  const actual = actualValues
    .map((value) => value.toUpperCase())
    .sort()
    .join(',')

  return actual === expected
}

function questionResultClasses(question: QuestionListItem) {
  const record = answerRecords.value[question.id]
  if (!record) return 'border-base-300 bg-base-100 text-base-content/70'

  return isAnswerCorrect(record, question)
    ? 'border-success bg-success text-white font-semibold'
    : 'border-error bg-error text-white font-semibold'
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

function buildResultSnapshot(
  paperId: string,
  submission: PracticeSubmitResponse,
): PracticeSubmissionResult {
  const questions = currentQuestions.value.map((question, index) => {
    const record = answerRecords.value[question.id]
    const correctAnswer = getReferenceAnswer(question)
    const status = !record
      ? ('unanswered' as const)
      : !correctAnswer
        ? ('pending' as const)
        : isAnswerCorrect(record, question)
          ? ('correct' as const)
          : ('wrong' as const)

    return {
      id: question.id,
      index: index + 1,
      title: question.title,
      questionType: question.questionType,
      userAnswer: record?.text ?? '',
      correctAnswer,
      explanation: (question as RichQuestionListItem).explanation,
      status,
    }
  })

  const correct = questions.filter((question) => question.status === 'correct').length
  const wrong = questions.filter((question) => question.status === 'wrong').length
  const unanswered = questions.filter((question) => question.status === 'unanswered').length
  const total = questions.length
  const answered = total - unanswered
  const graded = correct + wrong
  const accuracy = graded > 0 ? Math.round((correct / graded) * 100) : 0

  return {
    submissionId: submission.id,
    paperId,
    paperName: currentSessionTitle.value,
    subjectName: sessionSubjectName.value,
    score: accuracy,
    totalCount: total,
    answeredCount: answered,
    correctCount: correct,
    wrongCount: wrong,
    unansweredCount: unanswered,
    accuracy,
    elapsedSeconds: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000)),
    submittedAt: submission.submittedAt,
    questions,
    placeholder: submission.placeholder,
  }
}

function requestSubmitSession() {
  clearAutoAdvance()
  submitError.value = ''
  questionSheetOpen.value = false
  submitConfirmOpen.value = true
}

async function confirmSubmitSession() {
  if (submitting.value) return

  const paperId = route.params.paperId
  if (typeof paperId !== 'string' || !paperId) {
    submitError.value = '当前练习信息已失效，请返回后重新进入。'
    return
  }

  const payload: SubmitPracticeSessionBody = {
    paperId,
    subjectName: sessionSubjectName.value || undefined,
    elapsedSeconds: Math.max(0, Math.round((Date.now() - sessionStartedAt) / 1000)),
    answers: Object.values(answerRecords.value).map((record) => ({
      questionId: record.questionId,
      answer: record.text,
      values: record.values,
    })),
  }

  submitting.value = true
  submitError.value = ''

  let submission: PracticeSubmitResponse
  try {
    submission = await submitPracticeSession(payload)
  } catch {
    // Temporary local response until the real submission endpoint is finalized.
    submission = {
      id: `local_${Date.now()}`,
      paperId,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      placeholder: true,
    }
  }

  const result = buildResultSnapshot(paperId, submission)
  writePracticeResultSnapshot(result)
  submitting.value = false
  submitConfirmOpen.value = false
  app.endPracticeSession()

  await router.replace({
    name: ROUTE_NAMES.practiceResult,
    params: { paperId },
    query: {
      submissionId: submission.id,
      subject: sessionSubjectName.value || undefined,
    },
  })
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
  }, 560)
}

async function toggleFavorite() {
  const question = currentQuestion.value
  const paperId = route.params.paperId
  if (!question || typeof paperId !== 'string' || !paperId) return
  if (pendingFavoriteQuestionIds.value.has(question.id)) return

  favoriteError.value = ''
  const wasFavorited = favoriteQuestionIds.value.has(question.id)
  const nextIds = new Set(favoriteQuestionIds.value)
  if (wasFavorited) {
    nextIds.delete(question.id)
  } else {
    nextIds.add(question.id)
  }
  favoriteQuestionIds.value = nextIds

  const nextPendingIds = new Set(pendingFavoriteQuestionIds.value)
  nextPendingIds.add(question.id)
  pendingFavoriteQuestionIds.value = nextPendingIds

  try {
    if (wasFavorited) {
      await removeFavorite(question.id)
    } else {
      await addFavorite(question.id, paperId)
    }
  } catch {
    const rollbackIds = new Set(favoriteQuestionIds.value)
    if (wasFavorited) rollbackIds.add(question.id)
    else rollbackIds.delete(question.id)
    favoriteQuestionIds.value = rollbackIds
    favoriteError.value = '收藏状态更新失败，请稍后重试'
  } finally {
    const settledPendingIds = new Set(pendingFavoriteQuestionIds.value)
    settledPendingIds.delete(question.id)
    pendingFavoriteQuestionIds.value = settledPendingIds
  }
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
  router.push({ name: ROUTE_NAMES.practice })
}

function handleSessionStateAction() {
  if (sessionLoadState.value === 'error') {
    loadSessionData()
    return
  }

  exitSession()
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

function toQuestionListItem(item: PracticeAnswerSheetItem, subjectId: string): QuestionListItem {
  const richQuestion: RichQuestionListItem = {
    id: item.id,
    subjectId,
    title: item.title,
    questionType: item.questionType as QuestionType,
    questionCategory: 'practice',
    status: 'enabled',
    createdBy: 'system',
    createdAt: '',
    optionA: item.A ?? undefined,
    optionB: item.B ?? undefined,
    optionC: item.C ?? undefined,
    optionD: item.D ?? undefined,
    optionE: item.E ?? undefined,
    optionF: item.F ?? undefined,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation ?? undefined,
  }
  return richQuestion
}

function buildAnswerRecord(item: PracticeAnswerSheetItem): PracticeAnswerRecord | null {
  const answer = item.userAnswer
  if (!answer) return null

  const isChoice = ['single', 'multiple', 'judge'].includes(item.questionType)
  const values = isChoice ? parseChoiceAnswerValues(answer) : [answer]

  if (values.length === 0) return null

  return {
    questionId: item.id,
    text: answer,
    values,
  }
}

async function loadSessionData() {
  sessionLoadState.value = 'loading'
  currentIndex.value = 0
  currentQuestions.value = []
  selectedOptionValues.value = new Set()
  textAnswer.value = ''
  answerRecords.value = {}
  favoriteQuestionIds.value = new Set()
  pendingFavoriteQuestionIds.value = new Set()
  favoriteError.value = ''
  sessionTitles.value = []

  const paperId = route.params.paperId
  const paperIds = typeof paperId === 'string' && paperId ? [paperId] : []
  if (paperIds.length === 0) {
    sessionLoadState.value = 'missing'
    return
  }

  try {
    const sheets = await Promise.all(paperIds.map((paperId) => fetchPracticeAnswerSheet(paperId)))

    const questions: QuestionListItem[] = []
    const records: Record<string, PracticeAnswerRecord> = {}

    for (const sheet of sheets) {
      sessionTitles.value.push(sheet.paperName)
      for (const group of sheet.questionGroups) {
        for (const item of group.items) {
          questions.push(toQuestionListItem(item, sheet.subjectId))
          const record = buildAnswerRecord(item)
          if (record) records[item.id] = record
        }
      }
    }

    currentQuestions.value = questions.sort(compareQuestionType)
    answerRecords.value = records
    try {
      // 文档无收藏状态批量接口，用当前试卷的收藏列表代替
      const favoritesResult = await fetchFavorites({ paperId: paperIds[0] })
      favoriteQuestionIds.value = new Set(favoritesResult.items.map((item) => item.questionId))
    } catch {
      favoriteQuestionIds.value = new Set()
    }
    sessionLoadState.value = questions.length > 0 ? 'ready' : 'empty'
  } catch {
    currentQuestions.value = []
    sessionLoadState.value = 'error'
  }
}

onMounted(() => {
  app.setPracticeSessionActive(true)
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
  <section class="flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden">
    <header
      class="fixed left-1/2 top-0 z-40 w-full max-w-[32rem] -translate-x-1/2 border-b border-base-200/80 bg-base-100/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl"
    >
      <div class="grid h-14 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3">
        <button
          class="flex size-10 items-center justify-center rounded-full text-base-content transition active:bg-base-200"
          type="button"
          aria-label="退出练习"
          @click="exitSession"
        >
          <ArrowLeft :size="21" />
        </button>

        <h1 class="truncate text-center text-[15px] font-semibold leading-tight">
          {{ sessionSubjectName || currentSessionTitle }}
        </h1>

        <span aria-hidden="true"></span>
      </div>
      <div class="h-0.5 bg-base-200">
        <div
          class="h-full bg-primary transition-[width] duration-300"
          :style="{ width: `${progressPercent}%` }"
        ></div>
      </div>
    </header>

    <section
      v-if="sessionLoadState === 'loading'"
      class="-mx-5 flex flex-1 items-center justify-center px-6 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]"
    >
      <div class="text-center" role="status" aria-live="polite">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <p class="mt-3 text-sm font-medium text-base-content/60">正在准备题目…</p>
      </div>
    </section>

    <article
      v-else-if="currentQuestion"
      class="-mx-5 flex min-w-0 flex-1 flex-col pb-[calc(6.5rem+env(safe-area-inset-bottom))] pt-[calc(3.85rem+env(safe-area-inset-top))]"
      @touchstart.passive="handleTouchStart"
      @touchend.passive="handleTouchEnd"
    >
      <section class="min-w-0 px-5 pt-2">
        <div class="flex items-center justify-between gap-3">
          <span
            class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
          >
            {{ currentQuestionTypeLabel }}
          </span>
          <span class="truncate text-xs font-medium text-base-content/45">{{
            currentSessionTitle
          }}</span>
        </div>

        <h2 class="mt-2 whitespace-pre-line break-words text-base font-medium leading-[1.45]">
          {{ displayQuestionTitle }}
        </h2>
      </section>

      <section v-if="expectsChoiceQuestion" class="px-5 pt-3">
        <div
          class="grid gap-1.5"
          :class="currentQuestion.questionType === 'judge' ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <button
            v-for="option in resolvedQuestionOptions"
            :key="option.value"
            class="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition"
            :class="[optionClasses(option.value), currentAnswerRecord ? 'cursor-default' : '']"
            type="button"
            :aria-pressed="optionSelected(option.value)"
            @click="toggleOption(option.value)"
          >
            <span
              class="flex size-7 shrink-0 items-center justify-center border text-xs font-bold transition"
              :class="[
                isMultipleQuestion ? 'rounded-lg' : 'rounded-full',
                optionMarkerClasses(option.value),
              ]"
            >
              {{ option.label }}
            </span>
            <span class="min-w-0 flex-1 break-words text-[14px] leading-[1.55]">{{
              option.text
            }}</span>
          </button>
        </div>

        <button
          v-if="isMultipleQuestion && !currentAnswerRecord"
          class="btn btn-primary mt-3 h-10 min-h-10 w-full rounded-xl text-sm"
          type="button"
          :disabled="!canSubmitCurrentAnswer"
          @click="submitCurrentAnswer(true)"
        >
          确认答案
        </button>
      </section>

      <section v-else class="grid gap-3 px-5 pt-3">
        <textarea
          v-model="textAnswer"
          class="textarea min-h-[10rem] w-full resize-none rounded-xl border-base-200 bg-base-200/45 p-3.5 text-[15px] leading-relaxed focus:border-primary focus:bg-base-100 focus:outline-none"
          placeholder="在这里输入你的答案…"
          :disabled="Boolean(currentAnswerRecord)"
        ></textarea>

        <button
          v-if="!currentAnswerRecord"
          class="btn btn-primary h-10 min-h-10 w-full rounded-xl text-sm"
          type="button"
          :disabled="!canSubmitCurrentAnswer"
          @click="submitCurrentAnswer(true)"
        >
          确认答案
        </button>
      </section>

      <section v-if="currentAnswerRecord" class="mx-5 mt-4 border-t border-base-200 pt-3">
        <h3 class="text-sm font-semibold text-base-content">题目解析</h3>

        <p
          v-if="currentExplanation"
          class="mt-1.5 break-words text-sm leading-[1.55] text-base-content/65"
        >
          {{ currentExplanation }}
        </p>
        <p v-else class="mt-2 text-sm text-base-content/40">暂无解析</p>
      </section>
    </article>

    <div
      v-if="currentQuestion"
      class="fixed bottom-0 left-1/2 z-40 w-full max-w-[32rem] -translate-x-1/2 border-t border-base-200/80 bg-base-100/95 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl"
    >
      <p v-if="favoriteError" class="mb-2 text-center text-xs text-error">{{ favoriteError }}</p>
      <div class="grid grid-cols-4 items-center gap-1">
        <button
          class="flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium transition active:bg-base-200"
          :class="[
            currentQuestionFavorited ? 'text-primary' : 'text-base-content/60',
            currentQuestionFavoritePending ? 'opacity-50' : '',
          ]"
          type="button"
          :disabled="currentQuestionFavoritePending"
          :aria-label="currentQuestionFavorited ? '取消收藏' : '收藏题目'"
          @click="toggleFavorite"
        >
          <Bookmark
            :size="19"
            :class="currentQuestionFavorited ? 'fill-primary text-primary' : 'text-base-content/65'"
          />
          <span>{{ currentQuestionFavorited ? '已收藏' : '收藏' }}</span>
        </button>

        <div
          class="flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium tabular-nums text-base-content/60"
          :aria-label="`答对 ${correctCount} 题，答错 ${wrongCount} 题`"
        >
          <ClipboardCheck :size="19" />
          <span>
            <span class="text-success">对{{ correctCount }}</span>
            <span class="mx-0.5 text-base-content/25">/</span>
            <span class="text-error">错{{ wrongCount }}</span>
          </span>
        </div>

        <button
          class="flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium tabular-nums text-base-content/60 transition active:bg-base-200"
          type="button"
          aria-label="打开答题卡"
          @click="questionSheetOpen = true"
        >
          <Grid2X2 :size="19" />
          <span>{{ currentQuestionPosition }}/{{ currentQuestions.length }}</span>
        </button>

        <button
          class="flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium text-base-content/60 transition active:bg-base-200"
          type="button"
          aria-label="答题设置"
          @click="settingsModalOpen = true"
        >
          <Settings :size="19" />
          <span>设置</span>
        </button>
      </div>
    </div>

    <section
      v-else-if="sessionLoadState !== 'ready'"
      class="-mx-5 flex flex-1 items-center justify-center px-7 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]"
    >
      <div class="w-full max-w-sm text-center">
        <span
          class="mx-auto flex size-14 items-center justify-center rounded-full"
          :class="sessionStateContent.iconClasses"
        >
          <component :is="sessionStateContent.icon" :size="24" />
        </span>

        <h2 class="mt-4 text-base font-semibold text-base-content">
          {{ sessionStateContent.title }}
        </h2>
        <p class="mt-1.5 text-sm leading-relaxed text-base-content/55">
          {{ sessionStateContent.description }}
        </p>

        <div class="mx-auto mt-5 grid max-w-[15rem] gap-2.5">
          <button
            class="btn btn-primary h-11 min-h-11 rounded-full px-6 text-sm"
            type="button"
            @click="handleSessionStateAction"
          >
            {{ sessionStateContent.primaryLabel }}
          </button>
          <button
            v-if="sessionStateContent.showSecondaryAction"
            class="btn btn-ghost h-10 min-h-10 rounded-full text-sm text-base-content/55"
            type="button"
            @click="exitSession"
          >
            返回练习
          </button>
        </div>
      </div>
    </section>

    <BaseModal v-model="questionSheetOpen" title="答题卡" compact-footer>
      <div class="mb-3 flex items-center gap-3 border-b border-base-200 pb-3 text-xs tabular-nums">
        <span class="font-semibold text-base-content/70">
          {{ answeredCount }}/{{ currentQuestions.length }} 已完成
        </span>
        <span class="text-success">{{ correctCount }} 正确</span>
        <span class="text-error">{{ wrongCount }} 错误</span>
      </div>

      <div class="grid gap-2">
        <div v-for="[type, group] in questionSheetGroups" :key="type">
          <p class="mb-1.5 text-[13px] font-medium text-base-content/50">
            {{ QUESTION_TYPE_LABELS[type] }}（{{ group.questions.length }}题）
          </p>
          <div class="grid grid-cols-7 justify-items-center gap-1.5 sm:grid-cols-10">
            <button
              v-for="(question, offset) in group.questions"
              :key="question.id"
              class="flex size-9 items-center justify-center rounded-full border text-xs font-medium tabular-nums transition active:scale-90"
              :class="[
                questionResultClasses(question),
                currentIndex === group.startIndex + offset
                  ? 'ring-2 ring-base-content/20 ring-offset-1 ring-offset-base-100'
                  : '',
              ]"
              type="button"
              :aria-current="currentIndex === group.startIndex + offset ? 'step' : undefined"
              @click="goToQuestion(group.startIndex + offset)"
            >
              {{ group.startIndex + offset + 1 }}
            </button>
          </div>
        </div>
      </div>

      <template #footer>
        <button
          class="btn btn-primary h-10 min-h-10 w-full rounded-xl text-sm"
          type="button"
          :disabled="currentQuestions.length === 0"
          @click="requestSubmitSession"
        >
          <Send :size="15" />
          交卷
        </button>
      </template>
    </BaseModal>

    <BaseDialog v-model="submitConfirmOpen" title="确认交卷" :close-on-backdrop="!submitting">
      <p
        class="text-sm leading-6"
        :class="unansweredCount > 0 ? 'text-warning' : 'text-base-content/55'"
      >
        <template v-if="unansweredCount > 0">
          还有 {{ unansweredCount }} 题未答，交卷后不可修改。
        </template>
        <template v-else>交卷后不可修改。</template>
      </p>

      <p v-if="submitError" class="mt-3 text-sm text-error" role="alert">{{ submitError }}</p>

      <template #footer>
        <button
          class="btn h-10 min-h-10 flex-1 rounded-xl border-base-200 bg-base-100 text-sm"
          type="button"
          :disabled="submitting"
          @click="submitConfirmOpen = false"
        >
          取消
        </button>
        <button
          class="btn btn-primary h-10 min-h-10 flex-1 rounded-xl text-sm"
          type="button"
          :disabled="submitting"
          @click="confirmSubmitSession"
        >
          <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
          {{ submitting ? '提交中' : '确定' }}
        </button>
      </template>
    </BaseDialog>

    <PracticeSettingsContent v-model="settingsModalOpen" />
  </section>
</template>
