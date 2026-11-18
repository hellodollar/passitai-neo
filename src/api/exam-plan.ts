import { request } from '@/api/http'
import type { ExamPlan, UpdateExamPlanBody } from '@/types'

/** 文档:GET /api/practice/exam-plan */
export function fetchExamPlan() {
  return request<ExamPlan | null>('/practice/exam-plan')
}

/** 文档:PUT /api/practice/exam-plan */
export function updateExamPlan(payload: UpdateExamPlanBody) {
  return request<ExamPlan>('/practice/exam-plan', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}
