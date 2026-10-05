import { request } from '@/api/http'
import type { OptionItem } from '@/types/domain'

/** 文档:GET /api/options/majors（支持按 code 过滤） */
export function fetchMajorOptions(query: { code?: string } = {}) {
  return request<OptionItem[]>('/options/majors', {
    query,
  })
}

/** 文档:GET /api/options/subjects?majorId= */
export function fetchSubjectOptions(majorId: string) {
  return request<OptionItem[]>('/options/subjects', {
    query: { majorId },
  })
}
