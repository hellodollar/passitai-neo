import { request } from '@/api/http'
import type { PracticePlan, UpdatePracticePlanBody } from '@/types'

/** 文档:GET /api/practice/plan */
export function fetchPracticePlan() {
  return request<PracticePlan | null>('/practice/plan')
}

/** 文档:PUT /api/practice/plan */
export function updatePracticePlan(payload: UpdatePracticePlanBody) {
  return request<PracticePlan>('/practice/plan', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}
