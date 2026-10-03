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

/** 文档:POST /api/wrong-questions，body { questionId, paperId, subjectId }，幂等 */
export function addWrongQuestion(questionId: string, paperId: string, subjectId: string) {
  return request<WrongQuestion>('/wrong-questions', {
    method: 'POST',
    body: { questionId, paperId, subjectId },
  })
}

/** 文档:DELETE /api/wrong-questions/:id，按错题记录 ID 移除，幂等 */
export function removeWrongQuestion(id: string) {
  return request<null>(`/wrong-questions/${id}`, {
    method: 'DELETE',
  })
}
