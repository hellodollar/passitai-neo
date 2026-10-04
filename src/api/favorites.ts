import { request } from '@/api/http'
import type {
  CollectionAggregate,
  CollectionContext,
  CollectionPracticePaper,
  Favorite,
  PaginationResult,
} from '@/types/domain'

export type CollectionGroupBy = 'subject' | 'paper'
export type CollectionOrder = 'desc' | 'asc'

export type FavoriteListQuery = {
  page?: number
  limit?: number
  subjectId?: string
  paperId?: string
}

/** GET /api/favorites?page=&limit=&subjectId=&paperId=，分页收藏列表 */
export function fetchFavorites(query: FavoriteListQuery = {}) {
  return request<PaginationResult<Favorite> | Favorite[]>('/favorites', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      subjectId: query.subjectId,
      paperId: query.paperId,
    },
  })
}

// ── 聚合查询 / 清空 / 集合练习数据:后端端点暂缺,补充后启用 ──

export function fetchFavoriteAggregate(params: { groupBy?: CollectionGroupBy; order?: CollectionOrder } = {}) {
  return request<CollectionAggregate>('/favorites', { query: params })
}

/** PUT /api/favorites，body { questionId, subjectId, paperId }，幂等 */
export function addFavorite(payload: CollectionContext) {
  return request<Favorite | null>('/favorites', {
    method: 'PUT',
    body: payload,
  })
}

/** DELETE /api/favorites，body { questionId, subjectId, paperId }，幂等 */
export function removeFavorite(payload: CollectionContext) {
  return request<null>('/favorites', {
    method: 'DELETE',
    body: payload,
  })
}

// 后端端点暂缺
export function clearFavorites() {
  return request<null>('/favorites', { method: 'DELETE' })
}

// 后端端点暂缺
export function fetchFavoritePractice(params: { subjectId?: string; paperId?: string }) {
  return request<CollectionPracticePaper>('/favorites/practice', { query: params })
}
