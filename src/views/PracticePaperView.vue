<script setup lang="ts">
import {
  ArrowLeft,
  Bookmark,
  CircleAlert,
  ClipboardCheck,
  ClipboardList,
  Grid2X2,
  Settings,
  Trash2,
} from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import BaseDialog from '@/components/common/BaseDialog.vue'
import ClearPracticeRecordsDialog from '@/components/practice/ClearPracticeRecordsDialog.vue'
import PracticeQuestionPanel from '@/components/practice/PracticeQuestionPanel.vue'
import QuestionSheetModal from '@/components/practice/QuestionSheetModal.vue'
import PracticeSettingsModal from '@/components/settings/PracticeSettingsModal.vue'
import { usePracticeNavigation } from '@/composables/usePracticeNavigation'
import { useQuestionFavorites } from '@/composables/useQuestionFavorites'
import { useWrongQuestionSync } from '@/composables/useWrongQuestionSync'
import {
  addFavorite,
  fetchFavoritePractice,
  removeFavorite,
  removeFavoriteByRecord,
} from '@/api/favorites'
import {
  fetchWrongQuestionPractice,
} from '@/api/wrong-questions'
import { ROUTE_NAMES } from '@/constants/app'
import { practiceReturnTarget, returnFromPractice } from '@/utils/browse-state'
import { useAuthStore } from '@/stores/auth'
import { usePracticeStore } from '@/stores/practice'
import { fetchPracticePaper, fetchPracticeSubmission, submitPracticePaper } from '@/api/practice'
import {
  createPracticeRecord,
  readPracticeRecord,
  restorePracticeRecord,
  updatePracticeRecord,
  writePracticeRecord,
} from '@/utils/practice-record'
import {
  isPracticeRecordCurrent,
  subscribePracticeRecordChanges,
} from '@/utils/practice-record-control'
import type {
  CollectionContext,
  PracticeAnswerRecord,
  PracticePaperItem,
  PracticeRecord,
  PracticeRecordAnswer,
  PracticeRecordContext,
  PracticeRecordSource,
  PracticeSubmission,
  QuestionListItem,
} from '@/types'
import {
  getPreviewOptions,
  getQuestionOptions,
  getReferenceAnswer,
  isAnswerCorrect,
  isChoiceQuestionType,
} from '@/utils/practice-question'
import { preparePracticePaper, type QuestionSheetGroup } from '@/utils/practice-paper'
import { showErrorToast } from '@/utils/toast'
import { toSubmissionAnswers } from '@/utils/submission-answers'
import { preparePracticeSubmission, settlePracticeSubmission } from '@/utils/practice-submission'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const practice = usePracticeStore()

/** 收藏/错题练习模式：路由 paperId 形如 fav:<sub_xxx|pap_xxx>，query.source 指明集合 */
const COLLECTION_PAPER_PREFIX = 'fav:'
const collectionMode = computed(() => {
  const paperId = route.params.paperId
  return typeof paperId === 'string' && paperId.startsWith(COLLECTION_PAPER_PREFIX)
})
const collectionSource = computed(() =>
  route.query.source === 'wrong-questions' ? 'wrong-questions' : 'favorites',
)

type PaperLoadState = 'loading' | 'ready' | 'missing' | 'empty' | 'error'

const settingsModalOpen = ref(false)
const questionSheetOpen = ref(false)
const submitConfirmOpen = ref(false)
const clearRecordConfirmOpen = ref(false)
const submitting = ref(false)
const submitError = ref('')
const pendingSubmissionId = ref('')
const paperTitle = ref('')
const paperType = ref<PracticeRecordContext['paperType']>(null)
const practiceStartedAt = ref(Date.now())

const currentQuestions = ref<QuestionListItem[]>([])
const questionSheetGroups = ref<QuestionSheetGroup[]>([])
const currentIndex = ref(0)
const selectedOptionValues = ref<Set<string>>(new Set())
const textAnswer = ref('')
const answerRecords = ref<Record<string, PracticeAnswerRecord>>({})
const inputDrafts = ref<Record<string, PracticeRecordAnswer>>({})
const questionFingerprints = ref<Record<string, string>>({})
const localRecord = ref<PracticeRecord | null>(null)
const recordReady = ref(false)
let recordSaveTimer: number | null = null
let recordSaveWarningShown = false
let recordWasSaved = false
let loadSequence = 0
let unsubscribeRecordChanges = () => {}
/** 加载时的原始题目数据（PracticePaperItem），供交卷本地快照使用 */
const paperItemsById = ref<Map<string, PracticePaperItem>>(new Map())
const paperLoadState = ref<PaperLoadState>('loading')

const { clearAutoAdvance, handleTouchEnd, handleTouchStart, scheduleAutoAdvance } =
  usePracticeNavigation({
    currentIndex,
    questionCount: () => currentQuestions.value.length,
    suspended: () =>
      paperLoadState.value !== 'ready' ||
      questionSheetOpen.value ||
      settingsModalOpen.value ||
      submitConfirmOpen.value ||
      clearRecordConfirmOpen.value,
  })

const currentQuestion = computed(() => currentQuestions.value[currentIndex.value])
const currentPaperTitle = computed(() => paperTitle.value || '练习')
const paperSubjectName = computed(() => {
  const subject = route.query.subject
  return typeof subject === 'string' ? subject : ''
})
const currentAnswerRecord = computed(() =>
  currentQuestion.value ? answerRecords.value[currentQuestion.value.id] : undefined,
)
const answeredCount = computed(() => Object.keys(answerRecords.value).length)
const unansweredCount = computed(() =>
  Math.max(0, currentQuestions.value.length - answeredCount.value),
)
const currentQuestionPosition = computed(() =>
  currentQuestions.value.length === 0 ? 0 : currentIndex.value + 1,
)
const progressPercent = computed(() => {
  if (currentQuestions.value.length === 0) return 0
  return (currentQuestionPosition.value / currentQuestions.value.length) * 100
})
const {
  currentQuestionFavorited,
  currentQuestionFavoritePending,
  favoriteError,
  resetFavorites,
  toggleFavorite,
} = useQuestionFavorites({
  questionId: () => currentQuestion.value?.id,
  collectionMode: () => collectionMode.value,
  context: collectionContext,
  scopeKey: () => `${loadSequence}:${auth.session?.user.id ?? ''}`,
  add: addFavorite,
  remove: removeFavorite,
  removeById: removeFavoriteByRecord,
})
const paperStateContent = computed(() => {
  if (paperLoadState.value === 'error') {
    return {
      icon: CircleAlert,
      iconClasses: 'bg-error/10 text-error',
      title: '加载失败',
      description: '网络波动或题目异常，请重试。',
      primaryLabel: '重新加载',
      showSecondaryAction: true,
    }
  }

  if (paperLoadState.value === 'missing') {
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
const questionsById = computed(
  () => new Map(currentQuestions.value.map((question) => [question.id, question])),
)
const correctCount = computed(() => {
  let count = 0
  for (const record of Object.values(answerRecords.value)) {
    const question = questionsById.value.get(record.questionId)
    if (question && isChoiceQuestionType(question.questionType) && isAnswerCorrect(record, question))
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
        isChoiceQuestionType(question.questionType) &&
        Boolean(getReferenceAnswer(question)) &&
        !isAnswerCorrect(record, question)
      )
    }).length,
)

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

const { syncOnAnswered } = useWrongQuestionSync({ context: collectionContext })

function clearRecordSaveTimer() {
  if (recordSaveTimer !== null) {
    window.clearTimeout(recordSaveTimer)
    recordSaveTimer = null
  }
}

function saveRecordNow() {
  clearRecordSaveTimer()
  if (
    !recordReady.value ||
    !localRecord.value ||
    auth.session?.user.id !== localRecord.value.userId
  )
    return
  if (!isPracticeRecordCurrent(localRecord.value)) {
    resetClearedRecord()
    return
  }

  const answers = Object.fromEntries(
    Object.values(answerRecords.value).flatMap((record) => {
      const fingerprint = questionFingerprints.value[record.questionId]
      return fingerprint
        ? [[record.questionId, { ...record, fingerprint } satisfies PracticeRecordAnswer]]
        : []
    }),
  )
  localRecord.value = updatePracticeRecord(localRecord.value, {
    startedAt: practiceStartedAt.value,
    currentQuestionId: currentQuestion.value?.id ?? '',
    answers,
    inputs: inputDrafts.value,
    pendingSubmissionId: pendingSubmissionId.value,
    submissionAnswers: toSubmissionAnswers(answerRecords.value, currentQuestions.value),
  })
  pendingSubmissionId.value = localRecord.value.pendingSubmission?.submissionId ?? ''
  // 清理后的空白首题无需立刻生成一份新记录，第一次输入、切题或交卷再保存。
  if (!hasLocalRecordProgress.value && !recordWasSaved) return
  const saved = writePracticeRecord(localRecord.value)
  if (!saved && !recordSaveWarningShown) {
    recordSaveWarningShown = true
    showErrorToast('本地保存失败，离开后可能无法恢复本次作答。')
  }
  if (saved) {
    recordWasSaved = true
    recordSaveWarningShown = false
  }
}

const hasLocalRecordProgress = computed(
  () =>
    Object.keys(answerRecords.value).length > 0 ||
    Object.keys(inputDrafts.value).length > 0 ||
    currentIndex.value > 0 ||
    Boolean(localRecord.value?.pendingSubmission || localRecord.value?.lastSubmission),
)
// 仅专项训练提供页内记录清理；收藏、错题及其他题集模式不展示该入口。
const canClearRecord = computed(
  () => !collectionMode.value && paperType.value === 'baseline',
)
const clearRecordScope = computed(() =>
  localRecord.value
    ? {
        kind: 'paper' as const,
        identity: {
          userId: localRecord.value.userId,
          paperId: localRecord.value.paperId,
          source: localRecord.value.source,
        },
      }
    : null,
)

function requestClearRecord() {
  if (!canClearRecord.value || !hasLocalRecordProgress.value || submitting.value) return
  clearAutoAdvance()
  questionSheetOpen.value = false
  clearRecordConfirmOpen.value = true
}

function resetClearedRecord() {
  const record = localRecord.value
  if (!record || auth.session?.user.id !== record.userId) return
  clearAutoAdvance()
  clearRecordSaveTimer()
  // 失效正在进行的提交/恢复请求，不再让旧响应登记到新一轮作答。
  loadSequence++
  answerRecords.value = {}
  inputDrafts.value = {}
  currentIndex.value = 0
  practiceStartedAt.value = Date.now()
  localRecord.value = createPracticeRecord(record, practiceStartedAt.value)
  recordWasSaved = false
  pendingSubmissionId.value = ''
  submitConfirmOpen.value = false
  clearRecordConfirmOpen.value = false
  submitting.value = false
  submitError.value = ''
  questionSheetOpen.value = false
  syncCurrentInput()
}

function handleRecordChanges() {
  if (localRecord.value && !isPracticeRecordCurrent(localRecord.value)) resetClearedRecord()
}

function scheduleRecordSave() {
  if (!recordReady.value) return
  clearRecordSaveTimer()
  recordSaveTimer = window.setTimeout(saveRecordNow, 250)
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
  scheduleRecordSave()
}

function onTextAnswer(value: string) {
  textAnswer.value = value
  saveCurrentInput()
}

function syncCurrentInput() {
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

function toggleOption(optionValue: string) {
  if (currentAnswerRecord.value) return

  const nextValues = new Set(selectedOptionValues.value)

  if (currentQuestion.value?.questionType === 'multiple') {
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

  if (currentQuestion.value?.questionType !== 'multiple') {
    void submitCurrentAnswer()
  } else {
    saveCurrentInput()
  }
}

/** 选择题的作答文本取选项字母（与答后反馈展示一致）；主观题取输入内容。 */
function answerTextFor(question: QuestionListItem, values: string[]) {
  const options = getQuestionOptions(question)
  const resolved = options.length > 0 ? options : getPreviewOptions(question.questionType)
  if (resolved.length === 0) return textAnswer.value.trim()
  return resolved
    .filter((option) => values.includes(option.value))
    .map((option) => option.label)
    .join('、')
}

async function submitCurrentAnswer() {
  const question = currentQuestion.value
  if (!question || currentAnswerRecord.value) return
  const answeredIndex = currentIndex.value
  const sequence = loadSequence

  const values = [...selectedOptionValues.value]
  const record: PracticeAnswerRecord = {
    questionId: question.id,
    text: answerTextFor(question, values),
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
  saveRecordNow()
  void syncOnAnswered(question, record)

  // 仅「答对 + 开启自动切题」时前进；设置请求期间若用户已手动切题，不再跳过新题。
  if (isChoiceQuestionType(question.questionType) && isAnswerCorrect(record, question)) {
    const settings = await practice.ensureSettings()
    if (
      settings?.autoNext &&
      sequence === loadSequence &&
      currentIndex.value === answeredIndex &&
      !questionSheetOpen.value &&
      !settingsModalOpen.value &&
      !submitConfirmOpen.value
    ) {
      scheduleAutoAdvance()
    }
  }
}

function requestSubmitPaper() {
  clearAutoAdvance()
  submitError.value = ''
  questionSheetOpen.value = false
  submitConfirmOpen.value = true
}

async function confirmSubmitPaper() {
  if (submitting.value) return

  const paperIdParam = route.params.paperId
  saveRecordNow()
  const record = localRecord.value
  if (
    typeof paperIdParam !== 'string' ||
    !paperIdParam ||
    !recordReady.value ||
    !record ||
    record.paperId !== paperIdParam ||
    record.source !== 'practice' ||
    auth.session?.user.id !== record.userId ||
    currentQuestions.value.length === 0
  ) {
    submitError.value = '当前练习信息已失效，请返回后重新进入。'
    return
  }

  const sequence = loadSequence
  const subjectName = paperSubjectName.value
  submitting.value = true
  submitError.value = ''
  try {
    const plan = preparePracticeSubmission(
      record,
      toSubmissionAnswers(answerRecords.value, currentQuestions.value),
    )
    let submissionId: string
    if (plan.kind === 'report') {
      submissionId = plan.submissionId
    } else {
      localRecord.value = plan.record
      pendingSubmissionId.value = plan.pending.submissionId
      // 请求发出前保存幂等 ID 和固定快照，超时或刷新后可继续重试。
      saveRecordNow()
      const submission = await submitPracticePaper(paperIdParam, plan.pending.payload)
      if (!isCurrentSubmissionContext(sequence, record)) return
      saveRecordNow()
      localRecord.value = settlePracticeSubmission(localRecord.value!, plan.record, submission)
      pendingSubmissionId.value = localRecord.value.pendingSubmission?.submissionId ?? ''
      saveRecordNow()
      submissionId = submission.id
    }

    if (!isCurrentSubmissionContext(sequence, record)) return
    submitConfirmOpen.value = false
    practice.endSession()
    await router.replace({
      name: ROUTE_NAMES.practicePaperResult,
      params: { paperId: paperIdParam },
      query: {
        submissionId,
        subject: subjectName || undefined,
        returnTo: practiceReturnTarget(route.query, false),
      },
    })
  } catch (error) {
    if (isCurrentSubmissionContext(sequence, record)) {
      submitError.value = error instanceof Error ? error.message : '交卷失败，请重试。'
    }
  } finally {
    if (sequence === loadSequence) submitting.value = false
  }
}

function isCurrentSubmissionContext(sequence: number, record: PracticeRecord) {
  return (
    sequence === loadSequence &&
    recordReady.value &&
    route.params.paperId === record.paperId &&
    !collectionMode.value &&
    isPracticeRecordCurrent(record) &&
    auth.session?.user.id === record.userId &&
    localRecord.value?.userId === record.userId &&
    localRecord.value.paperId === record.paperId &&
    localRecord.value.source === record.source
  )
}

/** 超时请求可能已成功：后台核对元信息，不打断本地恢复、不自动跳报告。 */
async function reconcilePendingSubmission(sequence: number, record: PracticeRecord) {
  if (record.source !== 'practice' || !record.pendingSubmission) return
  let submission: PracticeSubmission
  try {
    submission = await fetchPracticeSubmission(
      record.paperId,
      record.pendingSubmission.submissionId,
    )
  } catch {
    // 尚未提交或网络不可用，保留快照，下一次交卷使用同一个 ID 重试。
    return
  }
  if (!isCurrentSubmissionContext(sequence, record)) return
  saveRecordNow()
  try {
    localRecord.value = settlePracticeSubmission(localRecord.value!, record, submission)
    pendingSubmissionId.value = localRecord.value.pendingSubmission?.submissionId ?? ''
    saveRecordNow()
  } catch {
    // 不可信或不匹配的响应不能改变本地答案及待提交状态。
  }
}

function goToQuestion(index: number) {
  if (index < 0 || index >= currentQuestions.value.length) return
  clearAutoAdvance()
  currentIndex.value = index
  questionSheetOpen.value = false
}

function exitPractice() {
  saveRecordNow()
  practice.endSession()
  returnFromPractice(router, practiceReturnTarget(route.query, collectionMode.value))
}

function handlePaperStateAction() {
  if (paperLoadState.value === 'error') {
    loadPaperData()
    return
  }

  exitPractice()
}

/** 收藏/错题练习数据加载：fav:<sub_xxx> 按科目 / fav:<pap_xxx> 按题集 */
async function loadCollectionPaper(paperId: string) {
  const originId = paperId.slice(COLLECTION_PAPER_PREFIX.length)
  const params = originId.startsWith('pap_') ? { paperId: originId } : { subjectId: originId }
  const { paper } =
    collectionSource.value === 'wrong-questions'
      ? await fetchWrongQuestionPractice(params)
      : await fetchFavoritePractice(params)
  return { paper, paperType: null, favoriteQuestionIds: [] as string[] }
}

async function loadPaperData() {
  saveRecordNow()
  recordReady.value = false
  clearRecordSaveTimer()
  const sequence = ++loadSequence
  submitting.value = false
  submitConfirmOpen.value = false
  submitError.value = ''
  paperLoadState.value = 'loading'
  currentIndex.value = 0
  currentQuestions.value = []
  questionSheetGroups.value = []
  selectedOptionValues.value = new Set()
  textAnswer.value = ''
  answerRecords.value = {}
  inputDrafts.value = {}
  questionFingerprints.value = {}
  pendingSubmissionId.value = ''
  practiceStartedAt.value = Date.now()
  localRecord.value = null
  recordWasSaved = false
  resetFavorites()
  paperItemsById.value = new Map()
  paperTitle.value = ''
  paperType.value = null
  clearRecordConfirmOpen.value = false

  const paperIdParam = route.params.paperId
  const userId = auth.session?.user.id
  const source: PracticeRecordSource = collectionMode.value ? collectionSource.value : 'practice'
  if (typeof paperIdParam !== 'string' || !paperIdParam) {
    paperLoadState.value = 'missing'
    return
  }

  try {
    const loaded =
      source === 'practice'
        ? await fetchPracticePaper(paperIdParam).then((detail) => ({
            ...detail,
            paperType: detail.paper.type,
          }))
        : await loadCollectionPaper(paperIdParam)
    if (sequence !== loadSequence) return
    const { paper } = loaded
    paperType.value = loaded.paperType
    paperTitle.value = paper.name
    const { questions, groups, fingerprints, itemsById } = preparePracticePaper(paper)

    currentQuestions.value = questions
    questionSheetGroups.value = groups
    questionFingerprints.value = fingerprints
    paperItemsById.value = itemsById
    resetFavorites(loaded.favoriteQuestionIds, [...itemsById.values()])
    if (questions.length === 0) {
      paperLoadState.value = 'empty'
      return
    }

    if (!userId || auth.session?.user.id !== userId) {
      paperLoadState.value = 'ready'
      return
    }

    const context: PracticeRecordContext = {
      userId,
      paperId: paperIdParam,
      source,
      subjectId: paper.subjectId,
      paperType: loaded.paperType,
    }
    const savedRecord = readPracticeRecord(context)
    recordWasSaved = Boolean(savedRecord)
    localRecord.value = savedRecord ?? createPracticeRecord(context)
    if (sequence !== loadSequence) return

    if (savedRecord) {
      const restored = restorePracticeRecord(savedRecord, questions, fingerprints)
      localRecord.value = restored.record
      answerRecords.value = restored.answers
      inputDrafts.value = restored.inputs
      practiceStartedAt.value = savedRecord.startedAt
      pendingSubmissionId.value = restored.record.pendingSubmission?.submissionId ?? ''
      currentIndex.value = restored.currentIndex
    }

    syncCurrentInput()
    paperLoadState.value = 'ready'
    recordReady.value = true
    if (savedRecord) {
      saveRecordNow()
      if (localRecord.value) void reconcilePendingSubmission(sequence, localRecord.value)
    }
  } catch {
    if (sequence !== loadSequence) return
    currentQuestions.value = []
    questionSheetGroups.value = []
    paperLoadState.value = 'error'
  }
}

onMounted(() => {
  practice.startSession()
  void practice.ensureSettings()
  window.addEventListener('pagehide', saveRecordNow)
  document.addEventListener('visibilitychange', saveRecordWhenHidden)
  unsubscribeRecordChanges = subscribePracticeRecordChanges(handleRecordChanges)
  loadPaperData()
})

onBeforeUnmount(() => {
  saveRecordNow()
  unsubscribeRecordChanges()
  loadSequence++
  window.removeEventListener('pagehide', saveRecordNow)
  document.removeEventListener('visibilitychange', saveRecordWhenHidden)
  practice.endSession()
})

function saveRecordWhenHidden() {
  if (document.visibilityState === 'hidden') saveRecordNow()
}

watch(
  () => currentQuestion.value?.id,
  () => {
    syncCurrentInput()
    scheduleRecordSave()
  },
)

watch(
  [() => route.params.paperId, () => (collectionMode.value ? collectionSource.value : 'practice')],
  () => {
    void loadPaperData()
  },
)

watch(questionSheetOpen, (open) => {
  if (open) clearAutoAdvance()
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
          @click="exitPractice"
        >
          <ArrowLeft :size="21" />
        </button>

        <h1 class="truncate text-center text-[15px] font-semibold leading-tight">
          {{ currentPaperTitle }}
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
      v-if="paperLoadState === 'loading'"
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
      <PracticeQuestionPanel
        :question="currentQuestion"
        :subject-name="paperSubjectName"
        :selected-values="selectedOptionValues"
        :text-answer="textAnswer"
        :answer-record="currentAnswerRecord"
        @toggle-option="toggleOption"
        @confirm-answer="submitCurrentAnswer()"
        @update:text-answer="onTextAnswer"
      />
    </article>

    <div
      v-if="currentQuestion"
      class="fixed bottom-0 left-1/2 z-40 w-full max-w-[32rem] -translate-x-1/2 border-t border-base-200/80 bg-base-100/95 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-xl"
    >
      <p v-if="favoriteError" class="mb-2 text-center text-xs text-error">{{ favoriteError }}</p>
      <div class="grid items-center gap-1" :class="canClearRecord ? 'grid-cols-5' : 'grid-cols-4'">
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
          v-if="canClearRecord"
          class="flex h-12 min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl text-[10px] font-medium text-base-content/60 transition active:bg-base-200 disabled:opacity-40"
          type="button"
          aria-label="清除做题记录"
          :disabled="!hasLocalRecordProgress || submitting"
          @click="requestClearRecord"
        >
          <Trash2 :size="19" />
          <span>清除</span>
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
      v-else-if="paperLoadState !== 'ready'"
      class="-mx-5 flex flex-1 items-center justify-center px-7 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(5rem+env(safe-area-inset-top))]"
    >
      <div class="w-full max-w-sm text-center">
        <span
          class="mx-auto flex size-14 items-center justify-center rounded-full"
          :class="paperStateContent.iconClasses"
        >
          <component :is="paperStateContent.icon" :size="24" />
        </span>

        <h2 class="mt-4 text-base font-semibold text-base-content">
          {{ paperStateContent.title }}
        </h2>
        <p class="mt-1.5 text-sm leading-relaxed text-base-content/55">
          {{ paperStateContent.description }}
        </p>

        <div class="mx-auto mt-5 grid max-w-[15rem] gap-2.5">
          <button
            class="btn btn-primary h-11 min-h-11 rounded-full px-6 text-sm"
            type="button"
            @click="handlePaperStateAction"
          >
            {{ paperStateContent.primaryLabel }}
          </button>
          <button
            v-if="paperStateContent.showSecondaryAction"
            class="btn btn-ghost h-10 min-h-10 rounded-full text-sm text-base-content/55"
            type="button"
            @click="exitPractice"
          >
            返回练习
          </button>
        </div>
      </div>
    </section>

    <QuestionSheetModal
      v-model="questionSheetOpen"
      :questions="currentQuestions"
      :groups="questionSheetGroups"
      :current-index="currentIndex"
      :answer-records="answerRecords"
      :answered-count="answeredCount"
      :correct-count="correctCount"
      :wrong-count="wrongCount"
      :show-submit="!collectionMode"
      @select="goToQuestion"
      @submit="requestSubmitPaper"
    />

    <BaseDialog
      v-model="submitConfirmOpen"
      title="确认交卷"
      :close-on-backdrop="!submitting"
      :close-on-escape="!submitting"
    >
      <p class="text-sm leading-6 text-base-content/70">
        <template v-if="unansweredCount > 0">
          还有 {{ unansweredCount }} 题未答，确定交卷？
        </template>
        <template v-else>确定交卷？</template>
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
          @click="confirmSubmitPaper"
        >
          <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
          {{ submitting ? '提交中' : '交卷' }}
        </button>
      </template>
    </BaseDialog>

    <PracticeSettingsModal v-model="settingsModalOpen" />
    <ClearPracticeRecordsDialog
      v-if="canClearRecord"
      v-model="clearRecordConfirmOpen"
      :scope="clearRecordScope"
      :label="`“${currentPaperTitle}”的本地做题记录`"
    />
  </section>
</template>
