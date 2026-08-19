import { request } from '@/api/http'
import type { QuestionListItem, QuestionListQuery, PaginationResult } from '@/types/domain'

export function fetchQuestions(query: QuestionListQuery = {}) {
  return request<PaginationResult<QuestionListItem>>('/questions', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      keyword: query.keyword,
      subjectId: query.subjectId,
      paperId: query.paperId,
      createdBy: query.createdBy,
    },
  })
}
