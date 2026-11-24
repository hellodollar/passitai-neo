import type { DomainValue, ProvinceCode } from '@/generated/domain-values'
import type { catalogPaperTypes, catalogPaperLayouts } from '@/generated/paper-catalog-values'

import type { QuestionType } from './question'

export type PaperType = (typeof catalogPaperTypes)[number]
export type PaperLayout = (typeof catalogPaperLayouts)[number]

export type Paper = {
  id: string
  subjectCode: string
  provinceCode: ProvinceCode
  name: string
  type: PaperType
  paperLayout: PaperLayout
  contentPeriod: string
  sourceType: DomainValue<'paperSourceType'>
  questionCount: number
}

export type PaperQuestion = {
  id: string
  subjectCode: string
  knowledgePoints?: string[]
  title: string
  type: QuestionType
  A: string | null
  B: string | null
  C: string | null
  D: string | null
  E: string | null
  F: string | null
  correctAnswer: string
  explanation: string | null
}

export type SimilarQuestionItem = PaperQuestion & {
  matchType: 'duplicate' | 'similar'
  matchedPointKeys: string[]
}

export type SimilarQuestionsResult = {
  questionId: string
  subjectCode: string
  knowledgePoints: string[]
  primaryPoint: string | null
  items: SimilarQuestionItem[]
}

export type PaperDetail = Paper & {
  sections: {
    name: string
    questionType?: QuestionType
    perScore?: number
    questionIds: string[]
    items: PaperQuestion[]
  }[]
}
