import { QUESTION_TYPE_LABELS } from '@/constants/domain'
import type {
  PracticePaperItem,
  PracticePaperLite,
  QuestionListItem,
} from '@/types/domain'
import { questionFingerprint } from '@/utils/practice-draft'
import { toQuestionListItem, type PracticeAnswerRecord } from '@/utils/practice-question'

export type QuestionSheetGroup = {
  key: string
  label: string
  startIndex: number
  questions: QuestionListItem[]
}

/** 将 API 题集按原 Section/题目顺序整理为练习页状态。 */
export function preparePracticeSession(paper: PracticePaperLite) {
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
      key: `${paper.id}-${index}`,
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

/** 交卷请求只携带当前题集的作答值，不携带页面展示文本。 */
export function toSubmissionAnswers(
  records: Record<string, PracticeAnswerRecord>,
  questions: QuestionListItem[],
): Record<string, string | string[]> {
  const byId = new Map(questions.map((question) => [question.id, question]))
  return Object.fromEntries(
    Object.values(records).map((record) => {
      const type = byId.get(record.questionId)?.questionType
      let answer: string | string[]
      if (type === 'multiple') answer = record.values
      else if (type === 'single' || type === 'judge') answer = record.values[0] ?? ''
      else answer = record.text
      return [record.questionId, answer]
    }),
  )
}
