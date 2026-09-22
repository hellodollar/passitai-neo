import { normalizePagination, request } from '@/api/http'
import type { PaginationResult, WrongQuestion, WrongQuestionStatus } from '@/types/domain'

export function fetchWrongQuestions(
  query: { page?: number; limit?: number; subjectId?: string; paperId?: string } = {},
) {
  return request<PaginationResult<WrongQuestion> | WrongQuestion[]>('/wrong-questions', {
    query: {
      page: query.page ?? 1,
      limit: query.limit ?? 100,
      subjectId: query.subjectId,
      paperId: query.paperId,
    },
  }).then(normalizePagination)
}

export async function fetchWrongQuestionStatus(questionIds: string[]) {
  const uniqueQuestionIds = [...new Set(questionIds)]
  if (uniqueQuestionIds.length === 0) return { questionIds: [] }

  const batches: string[][] = []
  for (let index = 0; index < uniqueQuestionIds.length; index += 200) {
    batches.push(uniqueQuestionIds.slice(index, index + 200))
  }

  const results = await Promise.all(
    batches.map((batch) =>
      request<WrongQuestionStatus>('/wrong-questions/status', {
        method: 'POST',
        body: { questionIds: batch },
      }),
    ),
  )
  return { questionIds: [...new Set(results.flatMap((result) => result.questionIds))] }
}

export function addWrongQuestion(questionId: string, paperId: string) {
  return request<WrongQuestion>(`/wrong-questions/questions/${questionId}`, {
    method: 'PUT',
    body: { paperId },
  })
}

export function removeWrongQuestion(questionId: string) {
  return request<null>(`/wrong-questions/questions/${questionId}`, {
    method: 'DELETE',
  })
}
