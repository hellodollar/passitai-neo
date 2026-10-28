import type { DomainValue } from '@/generated/domain-values'

export type QuestionType = DomainValue<'questionType'>

/** 题集详情与练习页共用的题目字段。 */
export type QuestionContent = {
  id: string
  title: string
  questionType: QuestionType
  A: string | null
  B: string | null
  C: string | null
  D: string | null
  E: string | null
  F: string | null
  correctAnswer: string
  explanation: string | null
}

export type QuestionListItem = QuestionContent & {
  subjectId: string
}
