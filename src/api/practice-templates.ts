import { request } from '@/api/http'
import type { PracticeTemplate } from '@/types/practice-template'

export function fetchPracticeTemplates(subjectCode: string, signal: AbortSignal) {
  return request<PracticeTemplate[]>('/practice/templates', { query: { subjectCode }, signal })
}
