import { computed, onBeforeUnmount, onMounted, ref, type Ref } from 'vue'

import type {
  PracticeAnswerRecord,
  PracticeRecord,
  PracticeRecordAnswer,
  PracticeRecordContext,
  QuestionListItem,
} from '@/types'
import {
  createPracticeRecord,
  readPracticeRecord,
  restorePracticeRecord,
  updatePracticeRecord,
  writePracticeRecord,
} from '@/utils/practice/record'
import {
  isPracticeRecordCurrent,
  subscribePracticeRecordChanges,
} from '@/utils/practice/record-control'
import { toSubmissionAnswers } from '@/utils/practice/submission-answers'
import { showErrorToast } from '@/utils/toast'

type PracticeRecordDependencies = {
  userId: () => string | undefined
  questions: Ref<QuestionListItem[]>
  onCleared: () => void
}

/** 本地记录的恢复、防抖保存、代际失效与生命周期清理。 */
export function usePracticeRecord(dependencies: PracticeRecordDependencies) {
  const startedAt = ref(Date.now())
  const currentIndex = ref(0)
  const answers = ref<Record<string, PracticeAnswerRecord>>({})
  const inputs = ref<Record<string, PracticeRecordAnswer>>({})
  const fingerprints = ref<Record<string, string>>({})
  const pendingSubmissionId = ref('')
  const localRecord = ref<PracticeRecord | null>(null)
  const recordReady = ref(false)
  let saveTimer: number | null = null
  let saveWarningShown = false
  let recordWasSaved = false
  let unsubscribe = () => {}

  const currentQuestionId = computed(
    () => dependencies.questions.value[currentIndex.value]?.id ?? '',
  )
  const hasLocalRecordProgress = computed(
    () =>
      Object.keys(answers.value).length > 0 ||
      Object.keys(inputs.value).length > 0 ||
      currentIndex.value > 0 ||
      Boolean(localRecord.value?.pendingSubmission || localRecord.value?.lastSubmission),
  )

  function clearSaveTimer() {
    if (saveTimer !== null) {
      window.clearTimeout(saveTimer)
      saveTimer = null
    }
  }

  function saveRecordNow() {
    clearSaveTimer()
    if (
      !recordReady.value ||
      !localRecord.value ||
      dependencies.userId() !== localRecord.value.userId
    ) {
      return
    }
    if (!isPracticeRecordCurrent(localRecord.value)) {
      resetClearedRecord()
      return
    }

    const savedAnswers = Object.fromEntries(
      Object.values(answers.value).flatMap((record) => {
        const fingerprint = fingerprints.value[record.questionId]
        return fingerprint
          ? [[record.questionId, { ...record, fingerprint } satisfies PracticeRecordAnswer]]
          : []
      }),
    )
    localRecord.value = updatePracticeRecord(localRecord.value, {
      startedAt: startedAt.value,
      currentQuestionId: currentQuestionId.value,
      answers: savedAnswers,
      inputs: inputs.value,
      pendingSubmissionId: pendingSubmissionId.value,
      submissionAnswers: toSubmissionAnswers(answers.value, dependencies.questions.value),
    })
    pendingSubmissionId.value = localRecord.value.pendingSubmission?.submissionId ?? ''
    // 清理后的空白首题无需立刻生成一份新记录，第一次输入、切题或交卷再保存。
    if (!hasLocalRecordProgress.value && !recordWasSaved) return
    const saved = writePracticeRecord(localRecord.value)
    if (!saved && !saveWarningShown) {
      saveWarningShown = true
      showErrorToast('本地保存失败，离开后可能无法恢复本次作答。')
    }
    if (saved) {
      recordWasSaved = true
      saveWarningShown = false
    }
  }

  function scheduleRecordSave() {
    if (!recordReady.value) return
    clearSaveTimer()
    saveTimer = window.setTimeout(saveRecordNow, 250)
  }

  /** 清理已失效记录时先重置本地状态，再通知页面取消切题、失效请求并重置界面。 */
  function resetClearedRecord() {
    const record = localRecord.value
    if (!record || dependencies.userId() !== record.userId) return
    clearSaveTimer()
    clearProgress()
    startedAt.value = Date.now()
    localRecord.value = createPracticeRecord(record, startedAt.value)
    recordWasSaved = false
    dependencies.onCleared()
  }

  function handleRecordChanges() {
    if (localRecord.value && !isPracticeRecordCurrent(localRecord.value)) resetClearedRecord()
  }

  function clearProgress() {
    answers.value = {}
    inputs.value = {}
    currentIndex.value = 0
    pendingSubmissionId.value = ''
  }

  /** 加载题集时恢复对应记录；返回是否存在恢复的保存记录。 */
  function loadSavedRecord(
    context: PracticeRecordContext,
    nextFingerprints: Record<string, string>,
  ) {
    fingerprints.value = nextFingerprints
    const savedRecord = readPracticeRecord(context)
    recordWasSaved = Boolean(savedRecord)
    if (!savedRecord) {
      clearProgress()
      startedAt.value = Date.now()
      localRecord.value = createPracticeRecord(context, startedAt.value)
      return false
    }

    const restored = restorePracticeRecord(
      savedRecord,
      dependencies.questions.value,
      nextFingerprints,
    )
    localRecord.value = restored.record
    startedAt.value = savedRecord.startedAt
    currentIndex.value = restored.currentIndex
    answers.value = restored.answers
    inputs.value = restored.inputs
    pendingSubmissionId.value = restored.record.pendingSubmission?.submissionId ?? ''
    return true
  }

  function resetRecordState() {
    clearSaveTimer()
    recordReady.value = false
    localRecord.value = null
    startedAt.value = Date.now()
    fingerprints.value = {}
    clearProgress()
    recordWasSaved = false
    saveWarningShown = false
  }

  function markRecordReady() {
    recordReady.value = true
  }

  function saveRecordWhenHidden() {
    if (document.visibilityState === 'hidden') saveRecordNow()
  }

  onMounted(() => {
    window.addEventListener('pagehide', saveRecordNow)
    document.addEventListener('visibilitychange', saveRecordWhenHidden)
    unsubscribe = subscribePracticeRecordChanges(handleRecordChanges)
  })

  onBeforeUnmount(() => {
    saveRecordNow()
    unsubscribe()
    window.removeEventListener('pagehide', saveRecordNow)
    document.removeEventListener('visibilitychange', saveRecordWhenHidden)
  })

  return {
    startedAt,
    currentIndex,
    answers,
    inputs,
    fingerprints,
    pendingSubmissionId,
    localRecord,
    recordReady,
    hasLocalRecordProgress,
    saveRecordNow,
    scheduleRecordSave,
    loadSavedRecord,
    resetRecordState,
    markRecordReady,
  }
}
