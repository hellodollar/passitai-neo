<script setup lang="ts">
import { Bookmark, CircleAlert, ClipboardList, Grid2X2, Settings2 } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { addFavorite, removeFavorite, removeFavoriteByRecord } from '@/api/favorites'
import { fetchPracticeSubmission, submitPracticePaper } from '@/api/practice'
import { fetchPracticeContent, type PracticeTarget } from '@/api/practice-content'
import BaseDialog from '@/components/common/BaseDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import AnswerSheetPopup from '@/components/practice/AnswerSheetPopup.vue'
import ClearPracticeRecordsDialog from '@/components/practice/ClearPracticeRecordsDialog.vue'
import PracticeQuestionPanel from '@/components/practice/PracticeQuestionPanel.vue'
import PracticeSettingsPopup from '@/components/practice/PracticeSettingsPopup.vue'
import { useMistakeSync } from '@/composables/useMistakeSync'
import { usePracticeNavigation } from '@/composables/usePracticeNavigation'
import { usePracticeRecord } from '@/composables/usePracticeRecord'
import { useQuestionFavorites } from '@/composables/useQuestionFavorites'
import { useQuestionSwipe } from '@/composables/useQuestionSwipe'
import { useAuthStore } from '@/stores/auth'
import { usePracticeSettingsStore } from '@/stores/practice-settings'
import type {
  CollectionContext,
  CollectionGroupBy,
  PracticeSource,
  PracticeAnswerRecord,
  PracticePaperItem,
  PracticeRecord,
  PracticeRecordContext,
  PracticeSubmission,
  QuestionListItem,
} from '@/types'
import { resolvePracticeReturn, returnToPracticeList } from '@/utils/browse/navigation'
import {
  preparePracticePaper,
  orderPracticePaper,
  type AnswerSheetGroup,
} from '@/utils/practice/paper'
import {
  getPreviewOptions,
  getQuestionOptions,
  getReferenceAnswer,
  isAnswerCorrect,
  isChoiceQuestionType,
} from '@/utils/practice/question'
import { isPracticeRecordCurrent } from '@/utils/practice/record-control'
import { preparePracticeSubmission, settlePracticeSubmission } from '@/utils/practice/submission'
import { toSubmissionAnswers } from '@/utils/practice/submission-answers'

const props = defineProps<{
  source: PracticeSource
  paperId?: string
  groupBy?: CollectionGroupBy
  groupId?: string
}>()

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const practiceSettingsStore = usePracticeSettingsStore()
const collectionMode = computed(() => props.source !== 'practice')
/** 普通题集使用真实 ID；集合练习用分组和资源 ID 标识本地作答。 */
const practiceId = computed(() =>
  props.source === 'practice'
    ? (props.paperId ?? '')
    : props.groupBy && props.groupId
      ? `collection:${props.groupBy}:${props.groupId}`
      : '',
)

type PaperLoadState = 'loading' | 'ready' | 'missing' | 'empty' | 'error'

const settingsPopupOpen = ref(false)
const answerSheetOpen = ref(false)
const submitConfirmOpen = ref(false)
const clearRecordConfirmOpen = ref(false)
const submitting = ref(false)
const canSubmit = ref(false)
const submitError = ref('')
const paperTitle = ref('')

const currentQuestions = ref<QuestionListItem[]>([])
const answerSheetGroups = ref<AnswerSheetGroup[]>([])
const selectedOptionValues = ref<Set<string>>(new Set())
const textAnswer = ref('')
let loadSequence = 0
/** 加载时的原始题目数据（PracticePaperItem），供交卷本地快照使用 */
const paperItemsById = ref<Map<string, PracticePaperItem>>(new Map())
const paperLoadState = ref<PaperLoadState>('loading')
/** 横滑舞台容器,用于测量宽度与绑定触摸事件 */
const questionStage = ref<HTMLElement | null>(null)

/** 悬浮层打开或试卷未就绪时,横滑与键盘切题一并挂起 */
const navigationSuspended = () =>
  paperLoadState.value !== 'ready' ||
  answerSheetOpen.value ||
  settingsPopupOpen.value ||
  submitConfirmOpen.value ||
  clearRecordConfirmOpen.value

const {
  currentIndex,
  answers: answerRecords,
  inputs: inputDrafts,
  fingerprints: questionFingerprints,
  pendingSubmissionId,
  localRecord,
  recordReady,
  hasLocalRecordProgress,
  saveRecordNow,
  scheduleRecordSave,
  loadSavedRecord,
  resetRecordState,
  markRecordReady,
} = usePracticeRecord({
  userId: () => auth.session?.user.id,
  questions: currentQuestions,
  onCleared: handleRecordCleared,
})

const {
  dragOffset: swipeOffset,
  settling: swipeSettling,
  enterFrom: swipeEnterFrom,
  moveBy: moveQuestionBy,
  jumpTo: jumpToQuestion,
  reset: resetSwipe,
  onTouchStart: onSwipeTouchStart,
  onTouchMove: onSwipeTouchMove,
  onTouchEnd: onSwipeTouchEnd,
} = useQuestionSwipe({
  index: currentIndex,
  count: () => currentQuestions.value.length,
  stageWidth: () => questionStage.value?.clientWidth ?? 0,
  suspended: navigationSuspended,
})

const { clearAutoAdvance, scheduleAutoAdvance } = usePracticeNavigation({
  currentIndex,
  questionCount: () => currentQuestions.value.length,
  suspended: navigationSuspended,
  move: (direction) => moveQuestionBy(direction),
})

const currentQuestion = computed(() => currentQuestions.value[currentIndex.value])
const currentPaperTitle = computed(() => paperTitle.value || '练习')
const paperSubjectName = computed(() => {
  const subjectName = route.query.subjectName
  return typeof subjectName === 'string' ? subjectName : ''
})
/** 横滑舞台的相邻题:仅作拖拽预览,不可交互 */
const prevQuestion = computed(() => currentQuestions.value[currentIndex.value - 1])
const nextQuestion = computed(() => currentQuestions.value[currentIndex.value + 1])
const questionEnterClass = computed(() => {
  if (swipeEnterFrom.value === 1) return 'question-enter-from-next'
  if (swipeEnterFrom.value === -1) return 'question-enter-from-prev'
  return ''
})

/** 相邻题面板的作答回显:与当前题一致,取自已确认答案或未确认草稿 */
function neighborPanelState(question: QuestionListItem) {
  const record = answerRecords.value[question.id] ?? inputDrafts.value[question.id]
  return {
    selectedValues: new Set(record?.values ?? []),
    textAnswer: record?.text ?? '',
    answerRecord: answerRecords.value[question.id],
  }
}
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
      tone: 'error' as const,
      title: '加载失败',
      description: '请稍后重试',
      primaryLabel: '重试',
      secondaryLabel: '返回',
    }
  }

  if (paperLoadState.value === 'missing') {
    return {
      icon: ClipboardList,
      tone: 'warning' as const,
      title: '练习不可用',
      description: '请返回重新选择',
      primaryLabel: '返回',
      secondaryLabel: '',
    }
  }

  return {
    icon: ClipboardList,
    tone: 'primary' as const,
    title: '暂无题目',
    description: '换个题集试试',
    primaryLabel: '返回',
    secondaryLabel: '',
  }
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
      isChoiceQuestionType(question.questionType) &&
      isAnswerCorrect(record, question)
    ) {
      count++
    }
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

/** 普通练习使用当前题集；集合练习使用题目携带的收录上下文。 */
function collectionContext(questionId: string): CollectionContext | null {
  const routePaperId = String(practiceId.value ?? '')
  if (!collectionMode.value) {
    const subjectId = currentQuestions.value[0]?.subjectId ?? ''
    if (!subjectId) return null
    return { questionId, subjectId, paperId: routePaperId }
  }
  // 收藏/错题练习：用服务端返回的收录上下文（记错题、再次收藏）
  const item = paperItemsById.value.get(questionId)
  if (!item?.subjectId || !item.paperId) return null
  return { questionId, subjectId: item.subjectId, paperId: item.paperId }
}

const { syncOnAnswered } = useMistakeSync({
  context: collectionContext,
  scopeKey: () => `${loadSequence}:${auth.session?.user.id ?? ''}`,
})

// 所有真实题集都有独立本地记录；收藏/错题练习不展示清除入口。
const canClearRecord = computed(
  () => !collectionMode.value && recordReady.value && localRecord.value?.source === 'practice',
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
  clearRecordConfirmOpen.value = true
}

/** composable 已重置记录状态；页面只取消切题、失效请求并重置界面。 */
function handleRecordCleared() {
  clearAutoAdvance()
  // 失效正在进行的提交/恢复请求，不再让旧响应登记到新一轮作答。
  loadSequence++
  resetSwipe()
  submitConfirmOpen.value = false
  clearRecordConfirmOpen.value = false
  submitting.value = false
  submitError.value = ''
  answerSheetOpen.value = false
  syncCurrentInput()
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
  void maybeAutoSubmitOnComplete(sequence)

  // 仅「答对 + 开启自动切题」时前进
  if (
    isChoiceQuestionType(question.questionType) &&
    isAnswerCorrect(record, question) &&
    practiceSettingsStore.settings.autoNext &&
    sequence === loadSequence &&
    currentIndex.value === answeredIndex &&
    !answerSheetOpen.value &&
    !settingsPopupOpen.value &&
    !submitConfirmOpen.value
  ) {
    scheduleAutoAdvance()
  }
}

/** 答完最后一题时按设置自动交卷;仅真实题集,收藏/错题纯刷题无交卷概念。 */
async function maybeAutoSubmitOnComplete(sequence: number) {
  if (!canSubmit.value || submitting.value || submitConfirmOpen.value) return
  if (
    !practiceSettingsStore.settings.autoSubmitAfterCompletion ||
    sequence !== loadSequence ||
    currentQuestions.value.length === 0 ||
    answeredCount.value !== currentQuestions.value.length
  ) {
    return
  }
  await confirmSubmitPaper()
}

function requestSubmitPaper() {
  if (!canSubmit.value) return
  clearAutoAdvance()
  submitError.value = ''
  submitConfirmOpen.value = true
}

async function confirmSubmitPaper() {
  if (!canSubmit.value || submitting.value) return

  const paperIdParam = practiceId.value
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
    await router.replace({
      name: 'practice-result',
      params: { paperId: paperIdParam, submissionId },
      query: {
        subjectName: subjectName || undefined,
        returnTo: resolvePracticeReturn(route.query, 'practice'),
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
    practiceId.value === record.paperId &&
    canSubmit.value &&
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
  if (!canSubmit.value || record.source !== 'practice' || !record.pendingSubmission) return
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
  jumpToQuestion(index)
  answerSheetOpen.value = false
}

function exitPractice() {
  saveRecordNow()
  returnToPracticeList(router, resolvePracticeReturn(route.query, props.source))
}

function handlePaperStateAction() {
  if (paperLoadState.value === 'error') {
    loadPaperData()
    return
  }

  exitPractice()
}

async function loadPaperData() {
  clearAutoAdvance()
  answerSheetOpen.value = false
  settingsPopupOpen.value = false
  saveRecordNow()
  resetRecordState()
  const sequence = ++loadSequence
  submitting.value = false
  canSubmit.value = false
  submitConfirmOpen.value = false
  submitError.value = ''
  paperLoadState.value = 'loading'
  resetSwipe()
  currentQuestions.value = []
  answerSheetGroups.value = []
  selectedOptionValues.value = new Set()
  textAnswer.value = ''
  resetFavorites()
  paperItemsById.value = new Map()
  paperTitle.value = ''
  clearRecordConfirmOpen.value = false

  const paperIdParam = practiceId.value
  const userId = auth.session?.user.id
  const sessionToken = auth.session?.token
  const source = props.source
  if (!userId || !auth.isAuthenticated || typeof paperIdParam !== 'string' || !paperIdParam) {
    paperLoadState.value = 'missing'
    return
  }
  try {
    const target: PracticeTarget =
      source === 'practice'
        ? { source, paperId: paperIdParam }
        : { source, groupBy: props.groupBy!, groupId: props.groupId! }
    const settings = practiceSettingsStore.load(userId)
    const loaded = await fetchPracticeContent(target)
    if (sequence !== loadSequence || sessionToken !== auth.session?.token) return
    const { paper } = loaded
    canSubmit.value = loaded.canSubmit
    paperTitle.value = paper.name
    const prepared = preparePracticePaper(paper)
    const { questions, groups, fingerprints, itemsById } = prepared

    currentQuestions.value = questions
    answerSheetGroups.value = groups
    paperItemsById.value = itemsById
    resetFavorites(loaded.favoriteQuestionIds, [...itemsById.values()])
    if (questions.length === 0) {
      paperLoadState.value = 'empty'
      return
    }

    const context: PracticeRecordContext = {
      userId,
      paperId: paperIdParam,
      source,
      subjectId: paper.subjectId,
      paperType: null,
    }
    const hasSavedRecord = loadSavedRecord(context, fingerprints)
    if (sequence !== loadSequence) return
    if (settings?.shuffleQuestions && localRecord.value) {
      const currentId = hasSavedRecord ? currentQuestions.value[currentIndex.value]?.id : undefined
      const ordered = orderPracticePaper(
        prepared,
        `${userId}|${paperIdParam}|${localRecord.value.startedAt}`,
      )
      currentQuestions.value = ordered.questions
      answerSheetGroups.value = ordered.groups
      currentIndex.value = currentId
        ? Math.max(
            0,
            ordered.questions.findIndex((question) => question.id === currentId),
          )
        : 0
    }

    syncCurrentInput()
    paperLoadState.value = 'ready'
    markRecordReady()
    if (hasSavedRecord) {
      saveRecordNow()
      if (localRecord.value) void reconcilePendingSubmission(sequence, localRecord.value)
    }
  } catch {
    if (sequence !== loadSequence || sessionToken !== auth.session?.token) return
    currentQuestions.value = []
    answerSheetGroups.value = []
    paperLoadState.value = 'error'
  }
}

onMounted(() => {
  loadPaperData()
})

onBeforeUnmount(() => {
  loadSequence++
})

watch(
  () => currentQuestion.value?.id,
  () => {
    syncCurrentInput()
    scheduleRecordSave()
    void nextTick(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
  },
)

watch([practiceId, () => props.source, () => auth.session?.token], () => {
  void loadPaperData()
})

watch(answerSheetOpen, (open) => {
  if (open) clearAutoAdvance()
})
</script>

<template>
  <section class="flex min-h-dvh w-full min-w-0 max-w-full flex-col overflow-x-hidden">
    <PageHeader :title="currentPaperTitle" back-label="退出练习" @back="exitPractice">
      <progress
        class="progress progress-primary block h-0.5 w-full rounded-none bg-base-200/65 dark:bg-base-300/45"
        :value="currentQuestionPosition"
        :max="Math.max(1, currentQuestions.length)"
        aria-label="当前题目进度"
      ></progress>
    </PageHeader>

    <section
      v-if="paperLoadState === 'loading'"
      class="flex flex-1 items-center justify-center px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(3.125rem+env(safe-area-inset-top))]"
    >
      <div class="text-center" role="status" aria-live="polite">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <p class="mt-3 text-sm font-medium text-base-content/70">正在准备题目…</p>
      </div>
    </section>

    <!-- 题目舞台:上一题/当前题/下一题三栏,横滑跟手,相邻题随拖拽露出 -->
    <article
      v-else-if="currentQuestion"
      class="flex min-w-0 flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] pt-[calc(3.125rem+env(safe-area-inset-top))]"
    >
      <div
        ref="questionStage"
        class="relative flex min-w-0 flex-1 flex-col overflow-x-clip [touch-action:pan-y_pinch-zoom]"
        @touchstart.passive="onSwipeTouchStart"
        @touchmove.passive="onSwipeTouchMove"
        @touchend.passive="onSwipeTouchEnd"
        @touchcancel.passive="onSwipeTouchEnd"
      >
        <div
          class="relative flex min-w-0 flex-1 flex-col will-change-transform"
          :class="swipeSettling ? 'question-track-settling' : ''"
          :style="swipeOffset ? { transform: `translateX(${swipeOffset}px)` } : undefined"
        >
          <!-- 定位容器按槽位固定且不加 key,避免题目在槽位间移动时跨模板复用导致样式错位 -->
          <div
            class="pointer-events-none absolute inset-y-0 left-[-100%] w-full overflow-hidden"
            aria-hidden="true"
            inert
          >
            <PracticeQuestionPanel
              v-if="prevQuestion"
              :question="prevQuestion"
              :subject-name="paperSubjectName"
              v-bind="neighborPanelState(prevQuestion)"
            />
          </div>

          <div class="relative flex min-w-0 flex-1 flex-col" :class="questionEnterClass">
            <PracticeQuestionPanel
              :key="currentQuestion.id"
              :question="currentQuestion"
              :subject-name="paperSubjectName"
              :selected-values="selectedOptionValues"
              :text-answer="textAnswer"
              :answer-record="currentAnswerRecord"
              @toggle-option="toggleOption"
              @confirm-answer="submitCurrentAnswer()"
              @update:text-answer="onTextAnswer"
            />
          </div>

          <div
            class="pointer-events-none absolute inset-y-0 right-[-100%] w-full overflow-hidden"
            aria-hidden="true"
            inert
          >
            <PracticeQuestionPanel
              v-if="nextQuestion"
              :question="nextQuestion"
              :subject-name="paperSubjectName"
              v-bind="neighborPanelState(nextQuestion)"
            />
          </div>
        </div>
      </div>
    </article>

    <!-- 空态/失效/失败占位:与加载态、题目舞台互斥,v-else-if 链不可被其他节点打断 -->
    <section
      v-else-if="paperLoadState !== 'ready'"
      class="flex flex-1 items-center justify-center px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[calc(3.125rem+env(safe-area-inset-top))]"
    >
      <div class="w-full max-w-sm">
        <EmptyState
          :icon="paperStateContent.icon"
          :tone="paperStateContent.tone"
          :title="paperStateContent.title"
          :description="paperStateContent.description"
          :action-label="paperStateContent.primaryLabel"
          :secondary-action-label="paperStateContent.secondaryLabel"
          embedded
          @action="handlePaperStateAction"
          @secondary-action="exitPractice"
        />
      </div>
    </section>

    <div
      v-if="currentQuestion"
      class="fixed bottom-0 left-1/2 z-40 w-full max-w-[32rem] -translate-x-1/2 border-t border-base-content/[0.06] bg-base-100/92 px-2.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl dark:border-base-content/[0.08]"
    >
      <p v-if="favoriteError" class="mb-1.5 text-center text-xs text-error">{{ favoriteError }}</p>
      <div class="flex h-10 items-center justify-between gap-0.5">
        <button
          class="flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-xs transition-colors active:bg-base-200/60 dark:active:bg-base-300/50"
          :class="[
            currentQuestionFavorited
              ? 'bg-primary/10 font-semibold text-primary'
              : 'font-medium text-base-content/70',
            currentQuestionFavoritePending ? 'opacity-50' : '',
          ]"
          type="button"
          :disabled="currentQuestionFavoritePending"
          :aria-label="currentQuestionFavorited ? '取消收藏' : '收藏题目'"
          @click="toggleFavorite"
        >
          <Bookmark
            :size="16"
            :class="currentQuestionFavorited ? 'fill-primary text-primary' : ''"
          />
          <span>{{ currentQuestionFavorited ? '已收藏' : '收藏' }}</span>
        </button>

        <button
          class="flex h-9 shrink-0 items-center gap-2 rounded-xl px-1.5 text-xs font-medium tabular-nums transition-colors active:bg-base-200/60 dark:active:bg-base-300/50"
          type="button"
          :aria-label="`答对 ${correctCount} 题，答错 ${wrongCount} 题，打开答题卡`"
          @click="answerSheetOpen = true"
        >
          <span class="flex items-center gap-1 text-success">
            <span class="size-1.5 rounded-full bg-success" aria-hidden="true"></span>
            对{{ correctCount }}
          </span>
          <span class="flex items-center gap-1 text-error">
            <span class="size-1.5 rounded-full bg-error" aria-hidden="true"></span>
            错{{ wrongCount }}
          </span>
        </button>

        <button
          class="flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-medium tabular-nums text-base-content transition-colors active:bg-base-200/60 dark:active:bg-base-300/50"
          type="button"
          aria-label="打开答题卡"
          @click="answerSheetOpen = true"
        >
          <Grid2X2 :size="16" class="text-base-content/70" />
          <span>{{ currentQuestionPosition }}/{{ currentQuestions.length }}</span>
        </button>

        <button
          class="flex h-9 shrink-0 items-center gap-1 rounded-xl px-2 text-xs font-medium text-base-content/70 transition-colors active:bg-base-200/60 dark:active:bg-base-300/50"
          type="button"
          aria-label="答题设置"
          @click="settingsPopupOpen = true"
        >
          <Settings2 :size="16" />
          <span>设置</span>
        </button>
      </div>
    </div>

    <AnswerSheetPopup
      v-model="answerSheetOpen"
      :questions="currentQuestions"
      :groups="answerSheetGroups"
      :current-index="currentIndex"
      :answer-records="answerRecords"
      :answered-count="answeredCount"
      :correct-count="correctCount"
      :wrong-count="wrongCount"
      :show-submit="canSubmit"
      :show-clear="canClearRecord"
      :clear-disabled="!hasLocalRecordProgress || submitting"
      @select="goToQuestion"
      @submit="requestSubmitPaper"
      @clear="requestClearRecord"
    />

    <BaseDialog
      v-model="submitConfirmOpen"
      title="确认交卷"
      :close-on-backdrop="!submitting"
      :close-on-escape="!submitting"
    >
      <p class="text-sm leading-relaxed text-base-content/70">
        <template v-if="unansweredCount > 0">
          还有 {{ unansweredCount }} 题未答，确定交卷？
        </template>
        <template v-else>确定交卷？</template>
      </p>

      <p v-if="submitError" class="mt-3 text-xs text-error" role="alert">{{ submitError }}</p>

      <template #footer>
        <button
          class="flex h-10 flex-1 items-center justify-center rounded-xl bg-base-200/70 text-sm font-medium text-base-content/75 transition-colors active:bg-base-200 disabled:opacity-50 dark:bg-base-300/45 dark:active:bg-base-300/70"
          type="button"
          :disabled="submitting"
          @click="submitConfirmOpen = false"
        >
          取消
        </button>
        <button
          class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-content transition-colors active:opacity-90 disabled:opacity-50"
          type="button"
          :disabled="submitting"
          @click="confirmSubmitPaper"
        >
          <span v-if="submitting" class="loading loading-spinner loading-xs"></span>
          {{ submitting ? '提交中' : '确定' }}
        </button>
      </template>
    </BaseDialog>

    <PracticeSettingsPopup v-model="settingsPopupOpen" />
    <ClearPracticeRecordsDialog
      v-if="canClearRecord"
      v-model="clearRecordConfirmOpen"
      :scope="clearRecordScope"
      :label="`“${currentPaperTitle}”的作答记录`"
    />
  </section>
</template>
