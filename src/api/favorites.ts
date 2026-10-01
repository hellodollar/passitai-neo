import { normalizePagination, request } from '@/api/http'
import type { Favorite, PaginationResult } from '@/types/domain'

export type FavoriteContext = Pick<Favorite, 'paperId' | 'subjectId' | 'questionId'>

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

/** 文档:PUT /api/favorites，body { paperId, subjectId, questionId }，幂等 */
export function addFavorite(context: FavoriteContext) {
  return request<Favorite>('/favorites', {
    method: 'PUT',
    body: context,
  })
}

/** 文档:DELETE /api/favorites，body { paperId, subjectId, questionId }，幂等 */
export function removeFavorite(context: FavoriteContext) {
  return request<null>('/favorites', {
    method: 'DELETE',
    body: context,
  })
}
