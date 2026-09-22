import { request } from '@/api/http'
import type { OptionItem } from '@/types/domain'

/** 文档:GET /api/options/majors */
export function fetchMajorOptions() {
  return request<OptionItem[]>('/options/majors')
}

/** 文档:GET /api/options/subjects?majorId= */
export function fetchSubjectOptions(majorId: string) {
  return request<OptionItem[]>('/options/subjects', {
    query: { majorId },
  })
}
