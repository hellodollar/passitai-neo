import { QUESTION_TYPE_LABELS } from '@/constants/entity'
import type {
  PracticePaperItem,
  PracticePaperLite,
  QuestionListItem,
} from '@/types'
import { questionFingerprint } from '@/utils/practice-record'
import { toQuestionListItem } from '@/utils/practice-question'

export type QuestionSheetGroup = {
  key: string
  label: string
  startIndex: number
  questions: QuestionListItem[]
}

/** 将 API 题集按原 Section/题目顺序整理为练习页所需的题目、分组与指纹。 */
export function preparePracticePaper(paper: PracticePaperLite) {
  const questions: QuestionListItem[] = []
  const groups: QuestionSheetGroup[] = []
  const fingerprints: Record<string, string> = {}
  const itemsById = new Map<string, PracticePaperItem>()

  for (const [index, section] of paper.sections.entries()) {
    const groupQuestions = section.items.map((item) => toQuestionListItem(item, paper.subjectId))
    for (const item of section.items) {
      fingerprints[item.id] = questionFingerprint(item)
      itemsById.set(item.id, item)
    }
    groups.push({
      key: `${paper.id ?? paper.subjectId}-${index}`,
      label: section.name || (section.questionType
        ? QUESTION_TYPE_LABELS[section.questionType]
        : `Section ${index + 1}`),
      startIndex: questions.length,
      questions: groupQuestions,
    })
    questions.push(...groupQuestions)
  }

  return { questions, groups, fingerprints, itemsById }
}
