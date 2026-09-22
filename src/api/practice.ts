import { request } from '@/api/http'
import type {
  PracticeAnswerSheet,
  PracticeEntry,
  PracticePlan,
  PracticeSettings,
  PracticeSubmitResponse,
  PracticeSubmissionResult,
  UpdatePracticePlanBody,
} from '@/types/domain'

/** 文档:GET /api/plan */
export function fetchPracticePlan() {
  return request<PracticePlan>('/plan')
}

/** 文档:PUT /api/plan */
export function updatePracticePlan(payload: UpdatePracticePlanBody) {
  return request<PracticePlan>('/plan', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}

/** 文档:GET /api/practice/entries?subjectId=（当前为占位数据） */
export function fetchPracticeEntries(subjectId: string) {
  return request<PracticeEntry[]>('/practice/entries', {
    query: { subjectId },
  })
}

/**
 * 文档未定义 answer-sheet 路径；收藏/错题/回顾页的题目详情暂依赖此接口，
 * 待第二阶段文档补充后替换。
 */
export function fetchPracticeAnswerSheet(paperId: string) {
  return request<PracticeAnswerSheet>('/practice/answer-sheet', {
    query: { paperId },
  })
}

/** 文档:GET /api/practice/settings */
export function fetchPracticeSettings() {
  return request<PracticeSettings>('/practice/settings')
}

/** 文档:PATCH /api/practice/settings */
export function updatePracticeSettings(payload: Partial<PracticeSettings>) {
  return request<PracticeSettings>('/practice/settings', {
    method: 'PATCH',
    body: payload,
  })
}

/**
 * 文档:POST /api/practice/records/:recordId/submit（占位阶段，提交体待第二阶段确定）。
 * 当前练习流程尚未接入记录创建，保留原契约等第二阶段对齐。
 */
export function submitPracticeSession(payload: Record<string, unknown>) {
  return request<PracticeSubmitResponse>('/practice/submit', {
    method: 'POST',
    body: payload,
  })
}

/**
 * 文档:GET /api/practice/records/:recordId/result（占位阶段）。
 * 依赖记录创建流程，同上留待第二阶段对齐。
 */
export function fetchPracticeSubmissionResult(paperId: string, submissionId?: string) {
  return request<PracticeSubmissionResult>('/practice/result', {
    query: { paperId, submissionId },
  })
}
