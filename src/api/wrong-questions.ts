import { normalizePagination, request } from '@/api/http'
import type { PaginationResult, WrongQuestion } from '@/types/domain'

export function fetchWrongQuestions(query: { page?: number; limit?: number; subjectId?: string } = {}) {
  return request<PaginationResult<WrongQuestion> | WrongQuestion[]>('/wrong-questions', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      subjectId: query.subjectId,
    },
  }).then(normalizePagination)
}

export function deleteWrongQuestion(id: string) {
  return request<null>(`/wrong-questions/${id}`, {
    method: 'DELETE',
  })
}
