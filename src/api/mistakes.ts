import { request } from '@/api/http'
import type {
  CollectionAggregate,
  CollectionContext,
  CollectionGroupBy,
  CollectionOrder,
  CollectionPracticePaper,
} from '@/types'

/** 文档:GET /api/wrong-questions?groupBy=&order=，聚合查询错题 */
export function fetchMistakeAggregate(
  params: { groupBy?: CollectionGroupBy; sort?: 'count' | 'recent'; order?: CollectionOrder } = {},
) {
  return request<CollectionAggregate>('/wrong-questions', { query: params })
}

/** 文档:POST /api/wrong-questions，body 三元组，幂等 */
export function addMistake(payload: CollectionContext) {
  return request<null>('/wrong-questions', {
    method: 'POST',
    body: payload,
  })
}

/** 文档:DELETE /api/wrong-questions，body 三元组，答对自动移除错题（幂等） */
export function removeMistakeByContext(payload: CollectionContext) {
  return request<null>('/wrong-questions', {
    method: 'DELETE',
    body: payload,
  })
}

/** 文档:DELETE /api/wrong-questions/all，清空错题 */
export function clearMistakes() {
  return request<null>('/wrong-questions/all', { method: 'DELETE' })
}

/** 文档:GET /api/wrong-questions/practice?subjectId= 或 ?paperId= */
export function fetchMistakePractice(params: { subjectId?: string; paperId?: string }) {
  return request<CollectionPracticePaper>('/wrong-questions/practice', { query: params })
}
