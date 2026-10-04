import { request } from '@/api/http'
import type { CollectionAggregate, CollectionContext, CollectionPracticePaper } from '@/types/domain'

export type CollectionGroupBy = 'subject' | 'paper'
export type CollectionOrder = 'desc' | 'asc'

/** 文档:GET /api/favorites?groupBy=&order=，聚合查询收藏 */
export function fetchFavoriteAggregate(params: { groupBy?: CollectionGroupBy; order?: CollectionOrder } = {}) {
  return request<CollectionAggregate>('/favorites', { query: params })
}

/** 文档:PUT /api/favorites，body 三元组，幂等 */
export function addFavorite(payload: CollectionContext) {
  return request<null>('/favorites', {
    method: 'PUT',
    body: payload,
  })
}

/** 文档:DELETE /api/favorites，body 三元组，幂等（真实题集训练页） */
export function removeFavorite(payload: CollectionContext) {
  return request<null>('/favorites', {
    method: 'DELETE',
    body: payload,
  })
}

/** 文档:DELETE /api/favorites/:recordId，按收藏记录 ID 取消（收藏训练页），幂等 */
export function removeFavoriteByRecord(recordId: string) {
  return request<null>(`/favorites/${recordId}`, { method: 'DELETE' })
}

/** 文档:DELETE /api/favorites/all，清空收藏 */
export function clearFavorites() {
  return request<null>('/favorites/all', { method: 'DELETE' })
}

/** 文档:GET /api/favorites/practice?subjectId= 或 ?paperId= */
export function fetchFavoritePractice(params: { subjectId?: string; paperId?: string }) {
  return request<CollectionPracticePaper>('/favorites/practice', { query: params })
}
