import { normalizePagination, request } from '@/api/http'
import type { Favorite, PaginationResult } from '@/types/domain'

export async function fetchFavorites(query: { page?: number; limit?: number; subjectId?: string } = {}) {
  const data = await request<PaginationResult<Favorite> | Favorite[]>('/favorites', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      subjectId: query.subjectId,
    },
  })

  return normalizePagination(data)
}

export function deleteFavorite(id: string) {
  return request<null>(`/favorites/${id}`, {
    method: 'DELETE',
  })
}
