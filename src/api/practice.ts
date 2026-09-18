import { request } from '@/api/http'
import type {
  CreatePracticeSessionBody,
  PracticeOverview,
  PracticePlan,
  PracticeSession,
  UpdatePracticePlanBody,
} from '@/types/domain'

export function fetchPracticePlan() {
  return request<PracticePlan>('/practice/plan')
}

export function updatePracticePlan(payload: UpdatePracticePlanBody) {
  return request<PracticePlan>('/practice/plan', {
    method: 'PUT',
    body: payload,
  })
}

export function fetchPracticeOverview() {
  return request<PracticeOverview>('/practice')
}

export function createPracticeSession(payload: CreatePracticeSessionBody) {
  return request<PracticeSession>('/practice/sessions', {
    method: 'POST',
    body: payload,
  })
}

export function fetchPracticeSession(id: string) {
  return request<PracticeSession>(`/practice/sessions/${id}`)
}
