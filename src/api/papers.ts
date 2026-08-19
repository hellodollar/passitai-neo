import { request } from '@/api/http'
import type { PaperListItem, PaperListQuery, PaginationResult } from '@/types/domain'

export function fetchPapers(query: PaperListQuery = {}) {
  return request<PaginationResult<PaperListItem>>('/papers', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      keyword: query.keyword,
      subjectId: query.subjectId,
      paperCategory: query.paperCategory,
      createdBy: query.createdBy,
    },
  })
}
