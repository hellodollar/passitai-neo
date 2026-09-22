import { normalizePagination, request } from '@/api/http'
import type { Favorite, FavoriteStatus, PaginationResult } from '@/types/domain'

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

export async function fetchFavoriteStatus(questionIds: string[]) {
  const uniqueQuestionIds = [...new Set(questionIds)]
  if (uniqueQuestionIds.length === 0) return { questionIds: [] }

  const batches: string[][] = []
  for (let index = 0; index < uniqueQuestionIds.length; index += 200) {
    batches.push(uniqueQuestionIds.slice(index, index + 200))
  }

  const results = await Promise.all(
    batches.map((batch) =>
      request<FavoriteStatus>('/favorites/status', {
        method: 'POST',
        body: { questionIds: batch },
      }),
    ),
  )
  return { questionIds: [...new Set(results.flatMap((result) => result.questionIds))] }
}

export function addFavorite(questionId: string, paperId: string) {
  return request<Favorite>(`/favorites/questions/${questionId}`, {
    method: 'PUT',
    body: { paperId },
  })
}

export function removeFavorite(questionId: string) {
  return request<null>(`/favorites/questions/${questionId}`, {
    method: 'DELETE',
  })
}
