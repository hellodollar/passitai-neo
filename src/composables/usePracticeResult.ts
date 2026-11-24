import { onScopeDispose, ref, watch } from 'vue'

import { fetchPaper, fetchPracticeSubmission, submitSubjectiveSelfGrade } from '@/api/practice'
import { useAuthStore } from '@/stores/auth'
import type { PaperDetail, PracticeSubmissionResult, SubjectiveSelfGradeRating } from '@/types'
import { buildSubmissionResult } from '@/utils/practice/result'

type PracticeResultOptions = {
  paperId: () => string
  submissionId: () => string
  subjectName: () => string
}

/** 加载当前账号的交卷报告并支持主观题三档自评；切换报告、会话或离页后不接纳旧请求。 */
export function usePracticeResult(options: PracticeResultOptions) {
  const auth = useAuthStore()
  const result = ref<PracticeSubmissionResult | null>(null)
  const loading = ref(false)
  const loadError = ref(false)
  const submittingSelfGrade = ref(false)
  const selfGradeError = ref('')
  let loadedPaper: PaperDetail | null = null
  let requestId = 0
  let disposed = false

  async function loadResult() {
    if (disposed) return
    const currentRequestId = ++requestId
    const paperId = options.paperId()
    const submissionId = options.submissionId()
    const subjectName = options.subjectName()
    const token = auth.session?.token
    const isCurrent = () =>
      !disposed &&
      currentRequestId === requestId &&
      token === auth.session?.token &&
      paperId === options.paperId() &&
      submissionId === options.submissionId()

    loading.value = true
    loadError.value = false
    selfGradeError.value = ''
    submittingSelfGrade.value = false
    loadedPaper = null
    result.value = null
    if (!paperId || !submissionId) {
      loadError.value = true
      loading.value = false
      return
    }
    if (!token) {
      loading.value = false
      return
    }

    try {
      const [paper, submission] = await Promise.all([
        fetchPaper(paperId),
        fetchPracticeSubmission(paperId, submissionId),
      ])
      if (!isCurrent()) return
      loadedPaper = paper
      result.value = buildSubmissionResult(paper, submission, subjectName)
    } catch {
      if (isCurrent()) loadError.value = true
    } finally {
      if (isCurrent()) loading.value = false
    }
  }

  async function submitSelfGrade(ratings: Record<string, SubjectiveSelfGradeRating>) {
    if (disposed || submittingSelfGrade.value || !loadedPaper || !result.value) return false
    const paper = loadedPaper
    const paperId = options.paperId()
    const submissionId = options.submissionId()
    const subjectName = options.subjectName()
    const token = auth.session?.token
    const currentRequestId = requestId
    if (!paperId || !submissionId || !token || Object.keys(ratings).length === 0) return false

    const isCurrent = () =>
      !disposed &&
      currentRequestId === requestId &&
      token === auth.session?.token &&
      paperId === options.paperId() &&
      submissionId === options.submissionId()

    submittingSelfGrade.value = true
    selfGradeError.value = ''
    try {
      const updated = await submitSubjectiveSelfGrade(paperId, submissionId, { ratings })
      if (!isCurrent()) return false
      result.value = buildSubmissionResult(paper, updated, subjectName)
      return true
    } catch (error) {
      if (isCurrent()) {
        selfGradeError.value = error instanceof Error ? error.message : '自评提交失败，请重试'
      }
      return false
    } finally {
      if (isCurrent()) submittingSelfGrade.value = false
    }
  }

  watch(
    [options.paperId, options.submissionId, () => auth.session?.token],
    () => void loadResult(),
    { immediate: true },
  )
  onScopeDispose(() => {
    disposed = true
    requestId++
  })

  return {
    result,
    loading,
    loadError,
    submittingSelfGrade,
    selfGradeError,
    loadResult,
    submitSelfGrade,
  }
}
