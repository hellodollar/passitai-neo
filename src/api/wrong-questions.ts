import { normalizePagination, request } from '@/api/http'
import type { PaginationResult, WrongQuestion } from '@/types/domain'

/** 文档:GET /api/wrong-questions?page=&limit=&subjectId=&paperId= */
export function fetchWrongQuestions(
  query: { page?: number; limit?: number; subjectId?: string; paperId?: string } = {},
) {
  return request<PaginationResult<WrongQuestion> | WrongQuestion[]>('/wrong-questions', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      subjectId: query.subjectId,
      paperId: query.paperId,
    },
  }).then(normalizePagination)
}

/** 文档:PUT /api/wrong-questions/:questionId，body { paperId }，幂等 */
export function addWrongQuestion(questionId: string, paperId: string) {
  return request<WrongQuestion>(`/wrong-questions/${questionId}`, {
    method: 'PUT',
    body: { paperId },
  })
}

/** 文档:DELETE /api/wrong-questions/:questionId，幂等 */
export function removeWrongQuestion(questionId: string) {
  return request<null>(`/wrong-questions/${questionId}`, {
    method: 'DELETE',
  })
}
