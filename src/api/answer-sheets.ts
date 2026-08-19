import { normalizePagination, request } from '@/api/http'
import type { AnswerSheetListItem, AnswerSheetListQuery, PaginationResult } from '@/types/domain'

export async function fetchAnswerSheets(query: AnswerSheetListQuery = {}) {
  const data = await request<PaginationResult<AnswerSheetListItem> | AnswerSheetListItem[]>(
    '/answer-sheets',
    {
      query: {
        page: query.page ?? 1,
        limit: query.limit ?? 100,
        paperId: query.paperId,
        status: query.status,
      },
    },
  )

  return normalizePagination(data)
}
