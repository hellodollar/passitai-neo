import { request } from '@/api/http'
import type {
  PaperDetail,
  PracticeResource,
  PracticeSubmission,
  SubjectiveSelfGradeBody,
  SubmitPracticePaperBody,
} from '@/types'

/** 文档:GET /api/practice/resources?subjectCode= */
export function fetchPracticeResources(subjectCode: string, signal?: AbortSignal) {
  return request<PracticeResource[]>('/practice/resources', { query: { subjectCode }, signal })
}

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
