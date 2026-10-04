import { request } from '@/api/http'
import type {
  CollectionAggregate,
  CollectionContext,
  CollectionPracticePaper,
  PaginationResult,
  WrongQuestion,
} from '@/types/domain'
import type { CollectionGroupBy, CollectionOrder } from '@/api/favorites'

export type WrongQuestionListQuery = {
  page?: number
  limit?: number
  subjectId?: string
  paperId?: string
}

/** GET /api/wrong-questions?page=&limit=&subjectId=&paperId=，分页错题列表 */
export function fetchWrongQuestions(query: WrongQuestionListQuery = {}) {
  return request<PaginationResult<WrongQuestion> | WrongQuestion[]>('/wrong-questions', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      subjectId: query.subjectId,
      paperId: query.paperId,
    },
  })
}

// ── 聚合查询 / 清空 / 集合练习数据:后端端点暂缺,补充后启用 ──
export function fetchWrongQuestionAggregate(params: { groupBy?: CollectionGroupBy; order?: CollectionOrder } = {}) {
  return request<CollectionAggregate>('/wrong-questions', { query: params })
}

/** POST /api/wrong-questions，body { questionId, subjectId, paperId }，幂等 */
export function addWrongQuestion(payload: CollectionContext) {
  return request<WrongQuestion | null>('/wrong-questions', {
    method: 'POST',
    body: payload,
  })
}

/** DELETE /api/wrong-questions/:id（wrq_ 记录 id），移除错题（幂等） */
export function removeWrongQuestion(id: string) {
  return request<null>(`/wrong-questions/${id}`, { method: 'DELETE' })
}

// 后端端点暂缺
export function clearWrongQuestions() {
  return request<null>('/wrong-questions', { method: 'DELETE' })
}

// 后端端点暂缺
export function fetchWrongQuestionPractice(params: { subjectId?: string; paperId?: string }) {
  return request<CollectionPracticePaper>('/wrong-questions/practice', { query: params })
}
