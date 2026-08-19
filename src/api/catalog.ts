import { request } from '@/api/http'
import type { Major, Subject } from '@/types/domain'

export function fetchMajors() {
  return request<Major[]>('/majors')
}

export function fetchSubjects(majorId?: string) {
  return request<Subject[]>('/subjects', {
    query: majorId ? { majorId } : undefined,
  })
}
