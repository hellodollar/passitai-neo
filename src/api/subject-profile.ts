import { request } from '@/api/http'
import type {
  EvaluateUserSubjectBody,
  GenerateAiEnhancePaperBody,
  GeneratedAiEnhancePaper,
  PaginationResult,
  UserSubjectEvaluation,
  UserSubjectProfile,
} from '@/types'

/** 文档:GET /api/subjects/:code/profile */
export function fetchSubjectProfile(subjectCode: string, signal?: AbortSignal) {
  return request<UserSubjectProfile>(`/subjects/${encodeURIComponent(subjectCode)}/profile`, {
    signal,
  })
}

/** 文档:POST /api/subjects/:code/evaluate */
export function evaluateSubject(subjectCode: string, body: EvaluateUserSubjectBody = {}) {
  return request<UserSubjectEvaluation>(`/subjects/${encodeURIComponent(subjectCode)}/evaluate`, {
    method: 'POST',
    body,
  })
}

/** 文档:GET /api/subjects/:code/evaluations?page=1&limit=10 */
export function fetchSubjectEvaluations(
  subjectCode: string,
  query: { page?: number; limit?: number } = {},
  signal?: AbortSignal,
) {
  return request<PaginationResult<UserSubjectEvaluation>>(
    `/subjects/${encodeURIComponent(subjectCode)}/evaluations`,
    { query, signal },
  )
}

/** 文档:POST /api/subjects/:code/ai-enhance/generate */
export function generateAiEnhancePaper(subjectCode: string, body: GenerateAiEnhancePaperBody) {
  return request<GeneratedAiEnhancePaper>(
    `/subjects/${encodeURIComponent(subjectCode)}/ai-enhance/generate`,
    {
      method: 'POST',
      body,
    },
  )
}

/** 文档:DELETE /api/subjects/:code/ai-enhance/papers/:paperId */
export function deleteAiEnhancePaper(subjectCode: string, paperId: string) {
  return request<null>(
    `/subjects/${encodeURIComponent(subjectCode)}/ai-enhance/papers/${encodeURIComponent(paperId)}`,
    { method: 'DELETE' },
  )
}
