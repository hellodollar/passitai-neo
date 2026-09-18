import { request } from '@/api/http'
import type { Major, OptionItem, Subject } from '@/types/domain'

export type OptionQuery = {
  majorId?: string
  id?: string
  code?: string
  ids?: string[]
  codes?: string[]
}

function toQuery(query: OptionQuery) {
  return {
    majorId: query.majorId,
    id: query.id,
    code: query.code,
    ids: query.ids?.length ? query.ids.join(',') : undefined,
    codes: query.codes?.length ? query.codes.join(',') : undefined,
  }
}

export function fetchMajors() {
  return request<Major[]>('/majors')
}

export function fetchSubjects(majorId?: string) {
  return request<Subject[]>('/subjects', {
    query: majorId ? { majorId } : undefined,
  })
}

export function fetchMajorOptions(query: OptionQuery = {}) {
  return request<OptionItem[]>('/options/majors', { query: toQuery(query) })
}

export function fetchSubjectOptions(query: OptionQuery = {}) {
  return request<OptionItem[]>('/options/subjects', { query: toQuery(query) })
}
