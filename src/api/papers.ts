import { request } from '@/api/http'
import type { PaperDetail } from '@/types'

export function fetchPaper(id: string) {
  return request<PaperDetail>(`/papers/${encodeURIComponent(id)}`)
}
