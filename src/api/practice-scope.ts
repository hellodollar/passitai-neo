import { request } from '@/api/http'
import type { PracticeScope, UpdatePracticeScopeBody } from '@/types'

/** 文档:GET /api/users/me/practice-scope */
export function fetchPracticeScope() {
  return request<PracticeScope | null>('/users/me/practice-scope')
}

/** 文档:PUT /api/users/me/practice-scope */
export function updatePracticeScope(payload: UpdatePracticeScopeBody) {
  return request<PracticeScope>('/users/me/practice-scope', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}
