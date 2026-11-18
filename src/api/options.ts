import { request } from '@/api/http'
import type { DomainValue, ProvinceCode } from '@/generated/domain-values'
import type { OptionItem, SubjectOptionItem } from '@/types'
import type { PaginationResult } from '@/types/api'

async function loadOptions<T extends OptionItem>(
  path: '/majors' | '/subjects',
  query: Record<string, string>,
) {
  const limit = 100
  const items: T[] = []
  for (let page = 1; ; page++) {
    const result = await request<PaginationResult<T>>(path, {
      query: { ...query, page, limit },
    })
    items.push(...result.items)
    if (page * limit >= result.total || result.items.length < limit) return items
  }
}

export function fetchMajorOptions(query: {
  provinceCode: ProvinceCode
  educationLevel: DomainValue<'educationLevel'>
}) {
  return loadOptions<OptionItem>('/majors', query)
}

export function fetchSubjectOptions(majorCode: string, provinceCode: ProvinceCode) {
  return loadOptions<SubjectOptionItem>('/subjects', { majorCode, provinceCode })
}
