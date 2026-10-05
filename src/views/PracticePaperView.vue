<script setup lang="ts">
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Grid2X2,
  Settings,
  XCircle,
} from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseDialog from '@/components/common/BaseDialog.vue'
import StudySettingsModal from '@/components/settings/StudySettingsModal.vue'
import {
  addFavorite,
  fetchFavoritePractice,
  removeFavorite,
  removeFavoriteByRecord,
} from '@/api/favorites'
import {
  addWrongQuestion,
  fetchWrongQuestionPractice,
  removeWrongQuestionByContext,
} from '@/api/wrong-questions'
import { ROUTE_NAMES } from '@/constants/app'
import { QUESTION_TYPE_LABELS } from '@/constants/domain'
import { useAppStore } from '@/stores/app'
import { useAuthStore } from '@/stores/auth'
import { usePracticeSettingsStore } from '@/stores/practiceSettings'
import { fetchPracticePaper, fetchPracticeSubmission, submitPracticePaper } from '@/api/practice'
import {
  readPracticeDraft,
  removePracticeDraft,
  restorePracticeDraft,
  writePracticeDraft,
  type PracticeDraftAnswer,
} from '@/utils/practice-draft'
import {
  getCorrectOptionValues,
  getPreviewOptions,
  getQuestionOptions,
  getReferenceAnswer,
  isAnswerCorrect,
  parseQuestionTitle,
  type PracticeAnswerRecord,
} from '@/utils/practice-question'
import {
  preparePracticeSession,
  toSubmissionAnswers,
  type QuestionSheetGroup,
} from '@/utils/practice-session'
import { showErrorToast } from '@/utils/toast'
import type {
  CollectionContext,
  PracticePaperItem,
  PracticeSubmission,
  QuestionListItem,
} from '@/types/domain'

const router = useRouter()
const route = useRoute()
const app = useAppStore()
const auth = useAuthStore()
const practiceSettings = usePracticeSettingsStore()

/** 收藏/错题练习模式：路由 paperId 形如 fav:<sub_xxx|pap_xxx>，query.source 指明集合 */
const COLLECTION_PAPER_PREFIX = 'fav:'
const collectionMode = computed(() => {
  const paperId = route.params.paperId
  return typeof paperId === 'string' && paperId.startsWith(COLLECTION_PAPER_PREFIX)
})
const collectionSource = computed(() =>
  route.query.source === 'wrong-questions' ? 'wrong-questions' : 'favorites',
)

type SessionLoadState = 'loading' | 'ready' | 'missing' | 'empty' | 'error'

const QUESTION_SHEET_RANGE_SIZE = 20

const settingsModalOpen = ref(false)
const questionSheetOpen = ref(false)
const questionSheetRef = ref<HTMLElement | null>(null)
const questionSheetRangeRef = ref<HTMLElement | null>(null)
const questionSheetContentRef = ref<HTMLElement | null>(null)
const questionSheetRangeIndex = ref(0)
const submitConfirmOpen = ref(false)
const submitting = ref(false)
const submitError = ref('')
const pendingSubmissionId = ref('')
const sessionTitle = ref('')
const sessionStartedAt = ref(Date.now())

const currentQuestions = ref<QuestionListItem[]>([])
const questionSheetGroups = ref<QuestionSheetGroup[]>([])
const currentIndex = ref(0)
const selectedOptionValues = ref<Set<string>>(new Set())
const textAnswer = ref('')
const answerRecords = ref<Record<string, PracticeAnswerRecord>>({})
const inputDrafts = ref<Record<string, PracticeDraftAnswer>>({})
const questionFingerprints = ref<Record<string, string>>({})
const draftUserId = ref('')
const draftPaperId = ref('')
const draftReady = ref(false)
let draftSaveTimer: number | null = null
let draftSaveWarningShown = false
let loadSequence = 0
let previousBodyOverflow = ''
const favoriteQuestionIds = ref<Set<string>>(new Set())
/** 加载时的原始题目数据（PracticePaperItem），供交卷本地快照使用 */
const paperItemsById = ref<Map<string, PracticePaperItem>>(new Map())
const pendingFavoriteQuestionIds = ref<Set<string>>(new Set())
const favoriteError = ref('')
let wrongRecordErrorShown = false
const touchStartX = ref(0)
const touchStartY = ref(0)
const autoAdvanceTimer = ref<number | null>(null)
const sessionLoadState = ref<SessionLoadState>('loading')

const currentQuestion = computed(() => currentQuestions.value[currentIndex.value])
const parsedQuestionTitle = computed(() => parseQuestionTitle(currentQuestion.value))
const displayQuestionTitle = computed(() => parsedQuestionTitle.value.title)
const currentQuestionOptions = computed(() => getQuestionOptions(currentQuestion.value))
const resolvedQuestionOptions = computed(() => {
  if (currentQuestionOptions.value.length > 0) return currentQuestionOptions.value
  return getPreviewOptions(currentQuestion.value?.questionType)
})
const currentSessionTitle = computed(() => sessionTitle.value || '练习')
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
const currentExplanation = computed(() => currentQuestion.value?.explanation ?? '')
const correctOptionValues = computed(
  () => new Set(getCorrectOptionValues(currentQuestion.value, resolvedQuestionOptions.value)),
)
const showOptionFeedback = computed(
  () => Boolean(currentAnswerRecord.value) && correctOptionValues.value.size > 0,
)

const currentAnswerCorrect = computed(() => {
  const question = currentQuestion.value
  const record = currentAnswerRecord.value
  return Boolean(question && record && isAnswerCorrect(record, question))
})

/** 横幅里的正确答案文案:选择题取选项字母,其余取参考答案 */
const currentCorrectAnswerText = computed(() => {
  const question = currentQuestion.value
  if (!question) return ''
  if (correctOptionValues.value.size > 0) {
    return resolvedQuestionOptions.value
      .filter((option) => correctOptionValues.value.has(option.value))
      .map((option) => option.label)
      .join('、')
  }
  return question.correctAnswer
})
const currentUserAnswerText = computed(() => {
  const record = currentAnswerRecord.value
  if (!record) return ''
  return record.text || record.values.join('、')
})
const canGradeCurrentAnswer = computed(
  () => isChoiceMode.value && correctOptionValues.value.size > 0,
)
const answeredCount = computed(() => Object.keys(answerRecords.value).length)
const unansweredCount = computed(() =>
  Math.max(0, currentQuestions.value.length - answeredCount.value),
)
const currentQuestionPosition = computed(() =>
  currentQuestions.value.length === 0 ? 0 : currentIndex.value + 1,
)
const questionSheetRanges = computed(() =>
  Array.from(
    { length: Math.ceil(currentQuestions.value.length / QUESTION_SHEET_RANGE_SIZE) },
    (_, index) => {
      const start = index * QUESTION_SHEET_RANGE_SIZE
      const end = Math.min(start + QUESTION_SHEET_RANGE_SIZE, currentQuestions.value.length)
      return { index, label: `${start + 1}–${end}`, start, end }
    },
  ),
)
const visibleQuestionSheetGroups = computed(() => {
  const start = questionSheetRangeIndex.value * QUESTION_SHEET_RANGE_SIZE
  const end = Math.min(start + QUESTION_SHEET_RANGE_SIZE, currentQuestions.value.length)
  return questionSheetGroups.value.flatMap((group) => {
    const visibleStart = Math.max(start, group.startIndex)
    const visibleEnd = Math.min(end, group.startIndex + group.questions.length)
    if (visibleStart >= visibleEnd) return []
    return [
      {
        key: group.key,
        label: group.label,
        startIndex: visibleStart,
        questions: group.questions.slice(
          visibleStart - group.startIndex,
          visibleEnd - group.startIndex,
        ),
      },
    ]
  })
})
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
const questionsById = computed(
  () => new Map(currentQuestions.value.map((question) => [question.id, question])),
)
const correctCount = computed(() => {
  let count = 0
  for (const record of Object.values(answerRecords.value)) {
    const question = questionsById.value.get(record.questionId)
    if (
      question &&
      ['single', 'multiple', 'judge'].includes(question.questionType) &&
      isAnswerCorrect(record, question)
    )
      count++
  }
  return count
})
const wrongCount = computed(
  () =>
    Object.values(answerRecords.value).filter((record) => {
      const question = questionsById.value.get(record.questionId)
      return (
        question &&
        ['single', 'multiple', 'judge'].includes(question.questionType) &&
        Boolean(getReferenceAnswer(question)) &&
        !isAnswerCorrect(record, question)
      )
    }).length,
)

function questionResultClasses(question: QuestionListItem) {
  const record = answerRecords.value[question.id]
  if (!record) return 'border-base-300 bg-base-100 text-base-content/70'
  if (
    !['single', 'multiple', 'judge'].includes(question.questionType) ||
    !getReferenceAnswer(question)
  ) {
    return 'border-warning/40 bg-warning/10 text-warning font-semibold'
  }

  return isAnswerCorrect(record, question)
    ? 'border-success bg-success text-white font-semibold'
    : 'border-error bg-error text-white font-semibold'
}

function clearDraftSaveTimer() {
  if (draftSaveTimer !== null) {
    window.clearTimeout(draftSaveTimer)
    draftSaveTimer = null
  }
}

function saveDraftNow() {
  clearDraftSaveTimer()
  if (
    !draftReady.value ||
    !draftUserId.value ||
    !draftPaperId.value ||
    auth.session?.user.id !== draftUserId.value
  )
    return

  const answers = Object.fromEntries(
    Object.values(answerRecords.value).flatMap((record) => {
      const fingerprint = questionFingerprints.value[record.questionId]
      return fingerprint
        ? [[record.questionId, { ...record, fingerprint } satisfies PracticeDraftAnswer]]
        : []
    }),
  )
  const saved = writePracticeDraft({
    version: 1,
    userId: draftUserId.value,
    paperId: draftPaperId.value,
    startedAt: sessionStartedAt.value,
    currentQuestionId: currentQuestion.value?.id ?? '',
    answers,
    inputs: inputDrafts.value,
    pendingSubmissionId: pendingSubmissionId.value,
    savedAt: Date.now(),
  })
  if (!saved && !draftSaveWarningShown) {
    draftSaveWarningShown = true
    showErrorToast('本地保存失败，离开后可能无法恢复本次作答。')
  }
  if (saved) draftSaveWarningShown = false
}

function scheduleDraftSave() {
  if (!draftReady.value) return
  clearDraftSaveTimer()
  draftSaveTimer = window.setTimeout(saveDraftNow, 250)
}

function saveCurrentInput() {
  const question = currentQuestion.value
  if (!question || currentAnswerRecord.value) return

  const values = [...selectedOptionValues.value]
  const text = textAnswer.value
  const nextInputs = { ...inputDrafts.value }
  if (values.length > 0 || text.length > 0) {
    nextInputs[question.id] = {
      questionId: question.id,
      fingerprint: questionFingerprints.value[question.id] ?? '',
      text,
      values,
    }
  } else {
    delete nextInputs[question.id]
  }
  inputDrafts.value = nextInputs
  scheduleDraftSave()
}

function handleTextInput(event: Event) {
  textAnswer.value = (event.target as HTMLTextAreaElement).value
  saveCurrentInput()
}

function syncCurrentDraft() {
  const question = currentQuestion.value
  if (!question) {
    selectedOptionValues.value = new Set()
    textAnswer.value = ''
    return
  }

  const record = answerRecords.value[question.id] ?? inputDrafts.value[question.id]
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
    void submitCurrentAnswer()
  } else {
    saveCurrentInput()
  }
}

async function submitCurrentAnswer() {
  const question = currentQuestion.value
  if (!question || !canSubmitCurrentAnswer.value) return
  const answeredIndex = currentIndex.value

  const values = [...selectedOptionValues.value]
  const selectedLabels = resolvedQuestionOptions.value
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)

  const record: PracticeAnswerRecord = {
    questionId: question.id,
    text: isChoiceMode.value ? selectedLabels.join('、') : textAnswer.value.trim(),
    values,
  }
  answerRecords.value = {
    ...answerRecords.value,
    [question.id]: record,
  }
  const nextInputs = { ...inputDrafts.value }
  delete nextInputs[question.id]
  inputDrafts.value = nextInputs
  pendingSubmissionId.value = ''
  saveDraftNow()
  void recordWrongAnswer(question, record)
  void removeMistakeIfCorrect(question, record)

  // 仅「答对 + 开启自动切题」时前进；设置请求期间若用户已手动切题，不再跳过新题。
  if (canGradeCurrentAnswer.value && isAnswerCorrect(record, question)) {
    const settings = await practiceSettings.ensure()
    if (
      settings?.autoNext &&
      currentIndex.value === answeredIndex &&
      !questionSheetOpen.value &&
      !settingsModalOpen.value &&
      !submitConfirmOpen.value
    ) {
      scheduleAutoAdvance()
    }
  }
}

/** 答对自动移除错题：设置开启且答对时移出错题本（幂等，无记录时静默） */
async function removeMistakeIfCorrect(question: QuestionListItem, record: PracticeAnswerRecord) {
  if (!['single', 'multiple', 'judge'].includes(question.questionType)) return
  if (!isAnswerCorrect(record, question)) return

  const userId = auth.session?.user.id
  const settings = await practiceSettings.ensure()
  if (!userId || auth.session?.user.id !== userId || !settings?.removeMistakeOnCorrect) return

  const context = collectionContext(question.id)
  if (!context) return

  try {
    await removeWrongQuestionByContext(context)
  } catch {
    // 静默失败：不打断答题流程
  }
}

async function recordWrongAnswer(question: QuestionListItem, record: PracticeAnswerRecord) {
  if (
    !['single', 'multiple', 'judge'].includes(question.questionType) ||
    getCorrectOptionValues(question).length === 0 ||
    isAnswerCorrect(record, question)
  )
    return

  const userId = auth.session?.user.id
  const settings = await practiceSettings.ensure()
  if (!userId || auth.session?.user.id !== userId) return
  if (!settings) {
    if (!wrongRecordErrorShown) {
      wrongRecordErrorShown = true
      showErrorToast('刷题设置加载失败，错题未保存。')
    }
    return
  }
  if (!settings.recordWrongQuestions) return
  const context = collectionContext(question.id)
  if (!context) return

  try {
    await addWrongQuestion(context)
  } catch {
    if (!wrongRecordErrorShown) {
      wrongRecordErrorShown = true
      showErrorToast('错题记录失败，请稍后重试。')
    }
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

  submitting.value = true
  submitError.value = ''
  if (!pendingSubmissionId.value) {
    const randomBytes = crypto.getRandomValues(new Uint8Array(6))
    pendingSubmissionId.value = `rec_${Array.from(randomBytes, (byte) =>
      byte.toString(16).padStart(2, '0'),
    ).join('')}`
  }
  saveDraftNow()
  const userAnswers = toSubmissionAnswers(answerRecords.value, currentQuestions.value)

  let submission: PracticeSubmission
  try {
    submission = await submitPracticePaper(paperId, {
      submissionId: pendingSubmissionId.value,
      userAnswers,
      startTime: new Date(sessionStartedAt.value).toISOString(),
    })
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : '交卷失败，请重试。'
    return
  } finally {
    submitting.value = false
  }

  submitConfirmOpen.value = false
  draftReady.value = false
  clearDraftSaveTimer()
  removePracticeDraft(draftUserId.value, draftPaperId.value)
  app.endPracticeSession()
  await router.replace({
    name: ROUTE_NAMES.practicePaperResult,
    params: { paperId },
    query: {
      submissionId: submission.id,
      subject: sessionSubjectName.value || undefined,
    },
  })
}

/** 收藏/记错上下文：真实题集取路由参数；fav: 虚拟题集取题目固化的收录上下文 */
function collectionContext(questionId: string): CollectionContext | null {
  const routePaperId = String(route.params.paperId ?? '')
  if (routePaperId.startsWith('pap_')) {
    const subjectId = currentQuestions.value[0]?.subjectId ?? ''
    if (!subjectId) return null
    return { questionId, subjectId, paperId: routePaperId }
  }
  // 收藏/错题练习：用服务端返回的收录上下文（记错题、再次收藏）
  const item = paperItemsById.value.get(questionId)
  if (!item?.subjectId || !item.paperId) return null
  return { questionId, subjectId: item.subjectId, paperId: item.paperId }
}

/** 收录记录 ID（收藏训练页取消收藏用） */
function collectionRecordOf(questionId: string): string | null {
  return paperItemsById.value.get(questionId)?.collectionRecordId ?? null
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
  }, 800)
}

async function toggleFavorite() {
  const question = currentQuestion.value
  if (!question) return
  if (pendingFavoriteQuestionIds.value.has(question.id)) return

  const wasFavorited = favoriteQuestionIds.value.has(question.id)
  const context = collectionContext(question.id)
  const recordId = collectionRecordOf(question.id)
  const removeByRecord = wasFavorited && collectionMode.value && Boolean(recordId)
  if (!context && !removeByRecord) {
    favoriteError.value = '当前题目缺少题集信息，无法更新收藏'
    return
  }

  favoriteError.value = ''
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
      // 收藏训练页按记录 ID 取消；真实题集训练页按三元组取消
      if (removeByRecord && recordId) {
        await removeFavoriteByRecord(recordId)
      } else if (context) {
        await removeFavorite(context)
      }
    } else if (context) {
      await addFavorite(context)
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

function handleNavigationKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    questionSheetOpen.value ||
    settingsModalOpen.value ||
    submitConfirmOpen.value ||
    sessionLoadState.value !== 'ready'
  ) {
    return
  }
  const target = event.target
  if (
    target instanceof HTMLElement &&
    (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
  ) {
    return
  }

  if (event.key === 'ArrowRight') {
    event.preventDefault()
    nextQuestion()
  } else if (event.key === 'ArrowLeft') {
    event.preventDefault()
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
  saveDraftNow()
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

/** 收藏/错题练习数据加载：fav:<sub_xxx> 按科目 / fav:<pap_xxx> 按题集 */
async function loadCollectionPaper(paperId: string) {
  const originId = paperId.slice(COLLECTION_PAPER_PREFIX.length)
  const params = originId.startsWith('pap_')
    ? { paperId: originId }
    : { subjectId: originId }
  const { paper } =
    collectionSource.value === 'wrong-questions'
      ? await fetchWrongQuestionPractice(params)
      : await fetchFavoritePractice(params)
  return { paper, favoriteQuestionIds: [] as string[] }
}

async function loadSessionData() {
  saveDraftNow()
  draftReady.value = false
  clearDraftSaveTimer()
  const sequence = ++loadSequence
  sessionLoadState.value = 'loading'
  currentIndex.value = 0
  currentQuestions.value = []
  questionSheetGroups.value = []
  selectedOptionValues.value = new Set()
  textAnswer.value = ''
  answerRecords.value = {}
  inputDrafts.value = {}
  questionFingerprints.value = {}
  pendingSubmissionId.value = ''
  sessionStartedAt.value = Date.now()
  draftUserId.value = ''
  draftPaperId.value = ''
  favoriteQuestionIds.value = new Set()
  paperItemsById.value = new Map()
  pendingFavoriteQuestionIds.value = new Set()
  favoriteError.value = ''
  sessionTitle.value = ''

  const paperId = route.params.paperId
  const userId = auth.session?.user.id
  if (typeof paperId !== 'string' || !paperId) {
    sessionLoadState.value = 'missing'
    return
  }

  try {
    const loaded = collectionMode.value
      ? await loadCollectionPaper(paperId)
      : await fetchPracticePaper(paperId)
    if (sequence !== loadSequence) return
    const { paper } = loaded
    // 收藏练习里全部题目本身就是收藏题；错题练习按常规收藏状态展示
    const initialFavoriteQuestionIds =
      collectionMode.value && collectionSource.value === 'favorites'
        ? paper.sections.flatMap((section) => section.items.map((item) => item.id))
        : loaded.favoriteQuestionIds

    sessionTitle.value = paper.name
    const { questions, groups, fingerprints, itemsById } = preparePracticeSession(paper)

    currentQuestions.value = questions
    questionSheetGroups.value = groups
    questionFingerprints.value = fingerprints
    paperItemsById.value = itemsById
    favoriteQuestionIds.value = new Set(initialFavoriteQuestionIds)
    if (questions.length === 0) {
      sessionLoadState.value = 'empty'
      return
    }

    if (!userId || auth.session?.user.id !== userId) {
      sessionLoadState.value = 'ready'
      return
    }

    draftUserId.value = userId
    draftPaperId.value = paperId
    const savedDraft = readPracticeDraft(userId, paperId)
    if (savedDraft?.pendingSubmissionId && !collectionMode.value) {
      let submission: PracticeSubmission | null = null
      try {
        submission = await fetchPracticeSubmission(paperId, savedDraft.pendingSubmissionId)
      } catch {
        // A timed-out submit may still be pending or the network may be offline.
        // Keep its idempotency ID so a retry cannot create a duplicate submission.
      }
      if (sequence !== loadSequence) return
      if (submission) {
        removePracticeDraft(userId, paperId)
        app.endPracticeSession()
        await router.replace({
          name: ROUTE_NAMES.practicePaperResult,
          params: { paperId },
          query: {
            submissionId: submission.id,
            subject: sessionSubjectName.value || undefined,
          },
        })
        return
      }
    }
    if (sequence !== loadSequence) return

    if (savedDraft) {
      const restored = restorePracticeDraft(savedDraft, questions, fingerprints)
      answerRecords.value = restored.answers
      inputDrafts.value = restored.inputs
      sessionStartedAt.value = savedDraft.startedAt
      pendingSubmissionId.value = restored.pendingSubmissionId
      currentIndex.value = restored.currentIndex
    }

    syncCurrentDraft()
    sessionLoadState.value = 'ready'
    draftReady.value = true
    if (savedDraft) scheduleDraftSave()
  } catch {
    if (sequence !== loadSequence) return
    currentQuestions.value = []
    questionSheetGroups.value = []
    sessionLoadState.value = 'error'
  }
}

onMounted(() => {
  app.setPracticeSessionActive(true)
  void practiceSettings.ensure()
  window.addEventListener('pagehide', saveDraftNow)
  window.addEventListener('keydown', handleNavigationKeydown)
  document.addEventListener('visibilitychange', saveDraftWhenHidden)
  loadSessionData()
})

onBeforeUnmount(() => {
  if (questionSheetOpen.value) document.body.style.overflow = previousBodyOverflow
  saveDraftNow()
  loadSequence++
  window.removeEventListener('pagehide', saveDraftNow)
  window.removeEventListener('keydown', handleNavigationKeydown)
  document.removeEventListener('visibilitychange', saveDraftWhenHidden)
  app.endPracticeSession()
  clearAutoAdvance()
})

function saveDraftWhenHidden() {
  if (document.visibilityState === 'hidden') saveDraftNow()
}

watch(
  () => currentQuestion.value?.id,
  () => {
    syncCurrentDraft()
    scheduleDraftSave()
  },
)

watch(
  () => route.params.paperId,
  (paperId, previousPaperId) => {
    if (paperId !== previousPaperId) loadSessionData()
  },
)

watch(questionSheetOpen, async (open) => {
  if (!open) {
    document.body.style.overflow = previousBodyOverflow
    return
  }
  clearAutoAdvance()
  questionSheetRangeIndex.value = Math.floor(currentIndex.value / QUESTION_SHEET_RANGE_SIZE)
  previousBodyOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  await nextTick()
  questionSheetRef.value?.focus()
  questionSheetRangeRef.value
    ?.querySelector('[aria-pressed="true"]')
    ?.scrollIntoView({ block: 'nearest', inline: 'center' })
})

watch(questionSheetRangeIndex, () => {
  if (questionSheetContentRef.value) questionSheetContentRef.value.scrollTop = 0
})
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
          {{ currentSessionTitle }}
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
      class="-mx-5 flex min-w-0 flex-1 flex-col pb-[calc(5rem+env(safe-area-inset-bottom))] pt-[calc(3.85rem+env(safe-area-inset-top))]"
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
          <span
            v-if="sessionSubjectName"
            class="min-w-0 flex-1 truncate text-right text-xs font-medium text-base-content/45"
          >
            {{ sessionSubjectName }}
          </span>
        </div>

        <h2 class="mt-2 whitespace-pre-line break-words text-base font-medium leading-[1.45]">
          {{ displayQuestionTitle }}
        </h2>
      </section>

      <section v-if="expectsChoiceQuestion" class="px-5 pt-2.5">
        <div
          class="grid gap-1.5"
          :class="currentQuestion.questionType === 'judge' ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <button
            v-for="option in resolvedQuestionOptions"
            :key="option.value"
            class="group flex min-h-11 min-w-0 items-center gap-2.5 rounded-lg border px-3 py-2 text-left transition"
            :class="[optionClasses(option.value), currentAnswerRecord ? 'cursor-default' : '']"
            type="button"
            :aria-pressed="optionSelected(option.value)"
            @click="toggleOption(option.value)"
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
            <span class="min-w-0 flex-1 break-words text-[14px] leading-[1.4]">{{
              option.text
            }}</span>
          </button>
        </div>

        <button
          v-if="isMultipleQuestion && !currentAnswerRecord"
          class="btn btn-primary mt-2.5 h-10 min-h-10 w-full rounded-xl text-sm"
          type="button"
          :disabled="!canSubmitCurrentAnswer"
          @click="submitCurrentAnswer()"
        >
          确认答案
        </button>
      </section>

      <section v-else class="grid gap-3 px-5 pt-3">
        <textarea
          v-model="textAnswer"
          @input="handleTextInput"
          class="textarea min-h-[10rem] w-full resize-none rounded-xl border-base-200 bg-base-200/45 p-3.5 text-[15px] leading-relaxed focus:border-primary focus:bg-base-100 focus:outline-none"
          placeholder="在这里输入你的答案…"
          :disabled="Boolean(currentAnswerRecord)"
        ></textarea>

        <button
          v-if="!currentAnswerRecord"
          class="btn btn-primary h-10 min-h-10 w-full rounded-xl text-sm"
          type="button"
          :disabled="!canSubmitCurrentAnswer"
          @click="submitCurrentAnswer()"
        >
          确认答案
        </button>
      </section>

      <section
        v-if="currentAnswerRecord"
        class="mx-5 mt-3 space-y-3 border-t border-base-200 pt-2.5"
      >
        <div
          class="rounded-lg border px-3 py-2.5"
          :class="
            !canGradeCurrentAnswer
              ? 'border-base-200 bg-base-200/40'
              : currentAnswerCorrect
                ? 'border-success/25 bg-success/[0.06]'
                : 'border-error/25 bg-error/[0.06]'
          "
          role="status"
        >
          <div
            class="flex items-center gap-1.5 text-sm font-semibold"
            :class="
              !canGradeCurrentAnswer
                ? 'text-base-content/70'
                : currentAnswerCorrect
                  ? 'text-success'
                  : 'text-error'
            "
          >
            <ClipboardCheck v-if="!canGradeCurrentAnswer" :size="16" />
            <CheckCircle2 v-else-if="currentAnswerCorrect" :size="16" />
            <XCircle v-else :size="16" />
            {{ !canGradeCurrentAnswer ? '已作答' : currentAnswerCorrect ? '回答正确' : '回答错误' }}
          </div>
          <dl
            class="mt-1.5 grid gap-x-3 gap-y-1 text-xs leading-5"
            :class="isChoiceMode ? 'grid-cols-2' : 'grid-cols-1'"
          >
            <div class="min-w-0">
              <dt class="inline text-base-content/50">我的答案 </dt>
              <dd
                class="inline break-words font-semibold"
                :class="
                  !canGradeCurrentAnswer
                    ? 'text-base-content/80'
                    : currentAnswerCorrect
                      ? 'text-success'
                      : 'text-error'
                "
              >
                {{ currentUserAnswerText || '—' }}
              </dd>
            </div>
            <div class="min-w-0">
              <dt class="inline text-base-content/50">
                {{ isChoiceMode ? '正确答案' : '参考答案' }}
              </dt>
              <dd
                class="inline break-words font-semibold"
                :class="isChoiceMode ? 'text-success' : 'text-base-content/80'"
              >
                {{ currentCorrectAnswerText || '暂无' }}
              </dd>
            </div>
          </dl>
        </div>

        <div>
          <h3 class="text-sm font-semibold text-base-content">题目解析</h3>
          <p
            v-if="currentExplanation"
            class="mt-1.5 break-words text-sm leading-[1.55] text-base-content/65"
          >
            {{ currentExplanation }}
          </p>
          <p v-else class="mt-2 text-sm text-base-content/40">暂无解析</p>
        </div>
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

    <Teleport to="body">
      <div
        v-if="questionSheetOpen"
        class="fixed inset-0 z-50 flex items-end justify-center bg-base-content/40 sm:items-center sm:px-4"
        @click.self="questionSheetOpen = false"
      >
        <section
          ref="questionSheetRef"
          class="flex max-h-[min(60dvh,24rem)] w-full max-w-[32rem] flex-col overflow-hidden rounded-t-2xl border-t border-base-200 bg-base-100 sm:rounded-2xl sm:border"
          role="dialog"
          aria-modal="true"
          aria-label="答题进度"
          tabindex="-1"
          @keydown.esc="questionSheetOpen = false"
        >
          <div class="flex h-13 shrink-0 items-center gap-3 border-b border-base-200 px-4">
            <span class="shrink-0 text-[15px] font-semibold tabular-nums">
              {{ answeredCount }}/{{ currentQuestions.length }}
            </span>
            <div class="flex min-w-0 flex-1 items-center gap-3 text-xs tabular-nums">
              <span class="flex items-center gap-1 text-base-content/55">
                <span class="size-1.5 rounded-full bg-success"></span>
                对 {{ correctCount }}
              </span>
              <span class="flex items-center gap-1 text-base-content/55">
                <span class="size-1.5 rounded-full bg-error"></span>
                错 {{ wrongCount }}
              </span>
            </div>
            <!-- 收藏/错题训练为纯刷题，不提供交卷。 -->
            <button
              v-if="!collectionMode"
              class="h-9 shrink-0 rounded-lg border border-primary/30 px-3 text-[13px] font-medium text-primary transition-colors active:bg-primary/10"
              type="button"
              :disabled="currentQuestions.length === 0"
              @click="requestSubmitSession"
            >
              交卷
            </button>
          </div>

          <div
            v-if="questionSheetRanges.length > 1"
            ref="questionSheetRangeRef"
            class="flex shrink-0 gap-1.5 overflow-x-auto border-b border-base-200 px-4 py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="题号区间"
          >
            <button
              v-for="range in questionSheetRanges"
              :key="range.index"
              class="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-medium tabular-nums transition-colors"
              :class="
                questionSheetRangeIndex === range.index
                  ? 'bg-primary/10 text-primary'
                  : 'text-base-content/55 active:bg-base-200'
              "
              type="button"
              :aria-label="`第 ${range.start + 1} 至 ${range.end} 题`"
              :aria-pressed="questionSheetRangeIndex === range.index"
              @click="questionSheetRangeIndex = range.index"
            >
              {{ range.label }}
            </button>
          </div>

          <div
            ref="questionSheetContentRef"
            class="min-h-0 overflow-y-auto overscroll-contain px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-2 sm:pb-4"
          >
            <section v-for="group in visibleQuestionSheetGroups" :key="group.key" class="pt-1.5">
              <p class="mb-1.5 text-xs font-medium text-base-content/50">
                {{ group.label }} · {{ group.questions.length }}题
              </p>
              <div
                class="grid grid-cols-8 justify-items-center gap-x-1 gap-y-1.5 min-[375px]:grid-cols-9 sm:grid-cols-10"
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
                  @click="goToQuestion(group.startIndex + offset)"
                >
                  {{ group.startIndex + offset + 1 }}
                </button>
              </div>
            </section>
          </div>
        </section>
      </div>
    </Teleport>

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

    <StudySettingsModal v-model="settingsModalOpen" />
  </section>
</template>
