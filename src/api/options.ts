import { request } from '@/api/http'
import type { DomainValue, ProvinceCode } from '@/generated/domain-values'
import type { OptionItem, PaginationResult, SubjectOptionItem } from '@/types'

export function fetchMajorOptions(query: {
  provinceCode: ProvinceCode
  educationLevel: DomainValue<'educationLevel'>
}) {
  return request<OptionItem[]>('/options/majors', { query: { ...query, limit: 100 } })
}

export async function fetchSubjectOptions(majorCode: string, provinceCode: ProvinceCode) {
  const limit = 100
  const items: SubjectOptionItem[] = []
  for (let page = 1; ; page++) {
    const result = await request<PaginationResult<SubjectOptionItem>>('/subjects', {
      query: { majorCode, provinceCode, page, limit },
    })
    items.push(...result.items)
    if (page * limit >= result.total || result.items.length < limit) return items
  }
}
