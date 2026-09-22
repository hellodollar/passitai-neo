import { normalizePagination, request } from '@/api/http'
import type { Favorite, PaginationResult } from '@/types/domain'

/** 文档:GET /api/favorites?page=&limit=&subjectId=&paperId= */
export async function fetchFavorites(
  query: { page?: number; limit?: number; subjectId?: string; paperId?: string } = {},
) {
  const data = await request<PaginationResult<Favorite> | Favorite[]>('/favorites', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      subjectId: query.subjectId,
      paperId: query.paperId,
    },
  })

  return normalizePagination(data)
}

/** 文档:PUT /api/favorites/:questionId，body { paperId }，幂等 */
export function addFavorite(questionId: string, paperId: string) {
  return request<Favorite>(`/favorites/${questionId}`, {
    method: 'PUT',
    body: { paperId },
  })
}

/** 文档:DELETE /api/favorites/:questionId，幂等 */
export function removeFavorite(questionId: string) {
  return request<null>(`/favorites/${questionId}`, {
    method: 'DELETE',
  })
}
