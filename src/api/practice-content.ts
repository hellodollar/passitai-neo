import { fetchFavoritePractice } from '@/api/favorites'
import { request } from '@/api/http'
import { fetchMistakePractice } from '@/api/mistakes'
import { fetchPaper } from '@/api/practice'
import type { CollectionGroupBy, PracticePaperLite, PracticeSource } from '@/types'

export type PracticeTarget =
  | { source: 'practice'; paperId: string }
  | { source: Exclude<PracticeSource, 'practice'>; groupBy: CollectionGroupBy; groupId: string }

/** 三种入口统一返回作答内容；科目 ID 只供当前收藏、错题协议使用。 */
export async function fetchPracticeContent(target: PracticeTarget): Promise<{
  paper: PracticePaperLite
  favoriteQuestionIds: string[]
  canSubmit: boolean
}> {
  if (target.source !== 'practice') {
    const query =
      target.groupBy === 'paper' ? { paperId: target.groupId } : { subjectId: target.groupId }
    const result =
      target.source === 'favorites'
        ? await fetchFavoritePractice(query)
        : await fetchMistakePractice(query)
    return { paper: result.paper, favoriteQuestionIds: [], canSubmit: false }
  }

  const paper = await fetchPaper(target.paperId)
  const subject = await request<{ id: string }>(
    `/subjects/${encodeURIComponent(paper.subjectCode)}`,
  )
  return {
    paper: {
      id: paper.id,
      name: paper.name,
      subjectId: subject.id,
      subjectCode: paper.subjectCode,
      paperType: paper.type,
      questionCount: paper.questionCount,
      sections: paper.sections.map((section) => ({
        name: section.name,
        questionType: section.questionType,
        perScore: section.perScore,
        items: section.items.map((question) => ({
          ...question,
          questionType: question.type,
          subjectId: subject.id,
          paperId: paper.id,
        })),
      })),
    },
    favoriteQuestionIds: [],
    canSubmit: true,
  }
}
