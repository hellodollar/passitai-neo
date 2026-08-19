import { request } from '@/api/http'
import type { CreatePracticeSessionBody, PracticeOverview, PracticeSession } from '@/types/domain'

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
