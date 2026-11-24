import { request } from '@/api/http'
import type {
  PaginationResult,
  PaperDetail,
  PracticeRecordSummary,
  PracticeSubmission,
  SimilarQuestionsResult,
  SubjectiveSelfGradeBody,
  SubmitPracticePaperBody,
} from '@/types'

/** 文档:GET /api/practice/papers/:paperId */
export function fetchPaper(paperId: string) {
  return request<PaperDetail>(`/practice/papers/${encodeURIComponent(paperId)}`)
}

/** 文档:POST /api/practice/papers/:paperId/submissions */
export function submitPracticePaper(paperId: string, payload: SubmitPracticePaperBody) {
  return request<PracticeSubmission>(
    `/practice/papers/${encodeURIComponent(paperId)}/submissions`,
    {
      method: 'POST',
      body: payload,
    },
  )
}

/** 文档:GET /api/practice/papers/:paperId/submissions/:submissionId */
export function fetchPracticeSubmission(paperId: string, submissionId: string) {
  return request<PracticeSubmission>(
    `/practice/papers/${encodeURIComponent(paperId)}/submissions/${encodeURIComponent(submissionId)}`,
  )
}

/** 文档:PUT /api/practice/papers/:paperId/submissions/:submissionId/subjective-self-grade */
export function submitSubjectiveSelfGrade(
  paperId: string,
  submissionId: string,
  payload: SubjectiveSelfGradeBody,
) {
  return request<PracticeSubmission>(
    `/practice/papers/${encodeURIComponent(paperId)}/submissions/${encodeURIComponent(submissionId)}/subjective-self-grade`,
    {
      method: 'PUT',
      body: payload,
    },
  )
}

/** 文档:GET /api/practice/records?subjectCode=&paperId=&page=&limit= */
export function fetchPracticeRecords(
  query: { subjectCode?: string; paperId?: string; page?: number; limit?: number } = {},
) {
  return request<PaginationResult<PracticeRecordSummary>>('/practice/records', { query })
}

/** 文档:GET /api/practice/questions/:questionId/similar?limit=5 */
export function fetchSimilarQuestions(questionId: string, limit = 5) {
  return request<SimilarQuestionsResult>(
    `/practice/questions/${encodeURIComponent(questionId)}/similar`,
    { query: { limit } },
  )
}
