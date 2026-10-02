import { request } from '@/api/http'
import type {
  PracticePaperDetail,
  PracticeEntry,
  PracticePlan,
  PracticeSettings,
  PracticeSubmission,
  SubmitPracticePaperBody,
  UpdatePracticePlanBody,
} from '@/types/domain'

/** 文档:GET /api/plan */
export function fetchPracticePlan() {
  return request<PracticePlan>('/plan')
}

/** 文档:PUT /api/plan */
export function updatePracticePlan(payload: UpdatePracticePlanBody) {
  return request<PracticePlan>('/plan', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}

/** 文档:GET /api/practice/entries?subjectId= */
export function fetchPracticeEntries(subjectId: string) {
  return request<PracticeEntry[]>('/practice/entries', {
    query: { subjectId },
  })
}

/** 文档:GET /api/practice/papers/:paperId */
export function fetchPracticePaper(paperId: string) {
  return request<PracticePaperDetail>(`/practice/papers/${paperId}`)
}

/** 文档:POST /api/practice/papers/:paperId/submissions */
export function submitPracticePaper(paperId: string, payload: SubmitPracticePaperBody) {
  return request<PracticeSubmission>(`/practice/papers/${paperId}/submissions`, {
    method: 'POST',
    body: payload,
  })
}

/** 文档:GET /api/practice/papers/:paperId/submissions/:submissionId */
export function fetchPracticeSubmission(paperId: string, submissionId: string) {
  return request<PracticeSubmission>(
    `/practice/papers/${paperId}/submissions/${submissionId}`,
  )
}

/** 文档:GET /api/practice/settings */
export function fetchPracticeSettings() {
  return request<PracticeSettings>('/practice/settings')
}

/** 文档:PATCH /api/practice/settings */
export function updatePracticeSettings(payload: Partial<PracticeSettings>) {
  return request<PracticeSettings>('/practice/settings', {
    method: 'PATCH',
    body: payload,
  })
}
