import { onScopeDispose, ref, watch } from 'vue'

import { fetchPracticePaper, fetchPracticeSubmission } from '@/api/practice'
import { useAuthStore } from '@/stores/auth'
import type { PracticeSubmissionResult } from '@/types'
import { buildSubmissionResult } from '@/utils/practice/result'

type PracticeResultOptions = {
  paperId: () => string
  submissionId: () => string
  subjectName: () => string
}

/** 加载当前账号的交卷报告；切换报告、会话或离页后不接纳旧请求。 */
export function usePracticeResult(options: PracticeResultOptions) {
  const auth = useAuthStore()
  const result = ref<PracticeSubmissionResult | null>(null)
  const loading = ref(false)
  const loadError = ref(false)
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
      const [detail, submission] = await Promise.all([
        fetchPracticePaper(paperId),
        fetchPracticeSubmission(paperId, submissionId),
      ])
      if (!isCurrent()) return
      result.value = buildSubmissionResult(detail, submission, paperId, subjectName)
    } catch {
      if (isCurrent()) loadError.value = true
    } finally {
      if (isCurrent()) loading.value = false
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

  return { result, loading, loadError, loadResult }
}
