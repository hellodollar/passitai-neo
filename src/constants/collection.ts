import type { CollectionOrder, CollectionSort } from '@/types/collection'

export const COLLECTION_SORT_OPTIONS: Array<{
  value: string
  field: CollectionSort
  order: CollectionOrder
  label: string
}> = [
  { value: 'recent-desc', field: 'recent', order: 'desc', label: '最近收录' },
  { value: 'recent-asc', field: 'recent', order: 'asc', label: '最早收录' },
  { value: 'count-desc', field: 'count', order: 'desc', label: '题目最多' },
  { value: 'count-asc', field: 'count', order: 'asc', label: '题目最少' },
]
