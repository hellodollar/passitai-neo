import { request } from '@/api/http'
import type {
  PaperDetail,
  PracticePaperDetail,
  PracticeSubmission,
  SubmitPracticePaperBody,
} from '@/types'

/** 文档:GET /api/practice/papers/:paperId */
export function fetchPaper(paperId: string) {
  return request<PaperDetail>(`/practice/papers/${paperId}`)
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
  return request<PracticeSubmission>(`/practice/papers/${paperId}/submissions/${submissionId}`)
}
