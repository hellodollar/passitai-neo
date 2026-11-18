import { request } from '@/api/http'
import type { DomainValue, ProvinceCode } from '@/generated/domain-values'
import type { OptionItem } from '@/types'
import type { PaginationResult } from '@/types/api'

async function loadOptions(path: '/majors' | '/subjects', query: Record<string, string>) {
  const limit = 100
  const items: OptionItem[] = []
  for (let page = 1; ; page++) {
    const result = await request<PaginationResult<OptionItem>>(path, {
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
  return loadOptions('/majors', query)
}

export function fetchSubjectOptions(majorCode: string, provinceCode: ProvinceCode) {
  return loadOptions('/subjects', { majorCode, provinceCode })
}
