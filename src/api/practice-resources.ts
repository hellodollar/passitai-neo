import { request } from '@/api/http'
import type { PracticeResource } from '@/types'

export function fetchPracticeResources(subjectCode: string, signal: AbortSignal) {
  return request<PracticeResource[]>('/practice/resources', { query: { subjectCode }, signal })
}
