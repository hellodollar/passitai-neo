import type { QuestionListItem } from '@/types/domain'
import type { PracticeAnswerRecord } from '@/types/practice-record'

/** 交卷请求只携带当前题集的作答值，不携带页面展示文本。 */
export function toSubmissionAnswers(
  records: Record<string, PracticeAnswerRecord>,
  questions: QuestionListItem[],
): Record<string, string | string[]> {
  const byId = new Map(questions.map((question) => [question.id, question]))
  return Object.fromEntries(
    Object.values(records).flatMap((record) => {
      const type = byId.get(record.questionId)?.questionType
      if (!type) return []
      let answer: string | string[]
      if (type === 'multiple') answer = record.values
      else if (type === 'single' || type === 'judge') answer = record.values[0] ?? ''
      else answer = record.text
      return [[record.questionId, answer]]
    }),
  )
}
