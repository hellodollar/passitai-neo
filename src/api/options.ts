import { request } from '@/api/http'
import type { DomainValue } from '@/generated/domain-values'
import type { OptionItem } from '@/types'

/** 文档:GET /api/options/majors（支持按省份与学历层次过滤） */
export function fetchMajorOptions(
  query: { code?: string; provinceCode?: string; educationLevel?: DomainValue<'educationLevel'> } = {},
) {
  return request<OptionItem[]>('/options/majors', {
    query,
  })
}

/** 文档:GET /api/options/subjects?majorId= */
export function fetchSubjectOptions(majorId: string, provinceCode?: string) {
  return request<OptionItem[]>('/options/subjects', {
    query: { majorId, provinceCode },
  })
}
