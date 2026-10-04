import { request } from '@/api/http'
import type {
  CollectionAggregate,
  CollectionContext,
  CollectionPracticePaper,
} from '@/types/domain'
import type { CollectionGroupBy, CollectionOrder } from '@/api/favorites'

/** 文档:GET /api/wrong-questions?groupBy=&order=，聚合查询错题 */
export function fetchWrongQuestionAggregate(
  params: { groupBy?: CollectionGroupBy; sort?: 'count' | 'recent'; order?: CollectionOrder } = {},
) {
  return request<CollectionAggregate>('/wrong-questions', { query: params })
}

/** 文档:POST /api/wrong-questions，body 三元组，幂等 */
export function addWrongQuestion(payload: CollectionContext) {
  return request<null>('/wrong-questions', {
    method: 'POST',
    body: payload,
  })
}

/** 文档:DELETE /api/wrong-questions/:recordId，按错题记录 ID 移除（错题训练页），幂等 */
export function removeWrongQuestion(recordId: string) {
  return request<null>(`/wrong-questions/${recordId}`, { method: 'DELETE' })
}

/** 文档:DELETE /api/wrong-questions/all，清空错题 */
export function clearWrongQuestions() {
  return request<null>('/wrong-questions/all', { method: 'DELETE' })
}

/** 文档:GET /api/wrong-questions/practice?subjectId= 或 ?paperId= */
export function fetchWrongQuestionPractice(params: { subjectId?: string; paperId?: string }) {
  return request<CollectionPracticePaper>('/wrong-questions/practice', { query: params })
}
