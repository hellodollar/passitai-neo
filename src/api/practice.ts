import { request } from '@/api/http'
import type {
  CreatePracticeSessionBody,
  PracticeAnswerSheet,
  PracticeEntry,
  PracticeOverview,
  PracticePlan,
  PracticeSession,
  PracticeSettings,
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

export function fetchPracticeEntries(subjectCode: string) {
  return request<PracticeEntry[]>('/practice/entries', {
    query: { code: subjectCode },
  })
}

export function fetchPracticeAnswerSheet(paperId: string) {
  return request<PracticeAnswerSheet>('/practice/answer-sheet', {
    query: { paperId },
  })
}

export function fetchPracticeSettings() {
  return request<PracticeSettings>('/practice/settings')
}

export function updatePracticeSettings(payload: Partial<PracticeSettings>) {
  return request<PracticeSettings>('/practice/settings', {
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
