import { request } from '@/api/http'
import type { StudyPlan, UpdatePlanBody } from '@/types/domain'

/** 文档:GET /api/plan */
export function fetchPlan() {
  return request<StudyPlan>('/plan')
}

/** 文档:PUT /api/plan */
export function updatePlan(payload: UpdatePlanBody) {
  return request<StudyPlan>('/plan', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}
