import { request } from '@/api/http'
import type {
  CollectionAggregate,
  CollectionContext,
  CollectionQuery,
  CollectionPracticePaper,
} from '@/types'

/** 文档:GET /api/mistakes?groupBy=&order=，聚合查询错题 */
export function fetchMistakeGroups(params: CollectionQuery = {}) {
  return request<CollectionAggregate>('/mistakes', { query: params })
}

/** 文档:POST /api/mistakes，body 三元组，幂等 */
export function addMistake(payload: CollectionContext) {
  return request<null>('/mistakes', {
    method: 'POST',
    body: payload,
  })
}

/** 文档:DELETE /api/mistakes，body 三元组，答对自动移除错题（幂等） */
export function removeMistakeByContext(payload: CollectionContext) {
  return request<null>('/mistakes', {
    method: 'DELETE',
    body: payload,
  })
}

/** 文档:DELETE /api/mistakes/all，清空错题 */
export function clearMistakes() {
  return request<null>('/mistakes/all', { method: 'DELETE' })
}

/** 文档:GET /api/mistakes/practice?subjectId= 或 ?paperId= */
export function fetchMistakePractice(params: { subjectId?: string; paperId?: string }) {
  return request<CollectionPracticePaper>('/mistakes/practice', { query: params })
}
