import { request } from '@/api/http'
import type { PaginationResult } from '@/types/api'
import type { Paper, PaperDetail, PaperType } from '@/types/paper'

export const PAPER_PAGE_SIZE = 20

export function fetchPapers(subjectCode: string, page: number, type?: PaperType) {
  return request<PaginationResult<Paper>>('/papers', {
    query: { subjectCode, page, limit: PAPER_PAGE_SIZE, type },
  })
}

export function fetchPaper(id: string) {
  return request<PaperDetail>(`/papers/${encodeURIComponent(id)}`)
}
