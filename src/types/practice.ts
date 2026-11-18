import type { DomainValue } from '@/generated/domain-values'

import type { CollectionSource } from './collection'
import type { QuestionContent, QuestionType } from './question'

// ---- Practice ----

export type PracticeSource = 'practice' | CollectionSource

/** 收藏/错题练习数据：与练习题集 paper 同构（无 type/assessmentType/latestRecord） */
export type CollectionPracticePaper = {
  paper: PracticePaperLite
}

export type PracticePaperLite = {
  /** 真实题集 ID；按科目聚合时没有题集 ID。 */
  id?: string
  name: string
  subjectId: string
  questionCount: number
  sections: Array<{
    name: string
    questionType?: QuestionType
    items: PracticePaperItem[]
  }>
}

export type PracticePaperItem = QuestionContent & {
  /** 收藏记录 ID，与错题记录 ID 分开；未收藏时为 null。 */
  favId?: string | null
  /** 错题记录 ID，只用于移除错题，不可用于取消收藏。 */
  mistakeId?: string | null
  subjectId?: string | null
  paperId?: string | null
}

export type PracticePaperSection = {
  name: string
  /** 缺失表示通用 Section，组内可包含不同题型。 */
  questionType?: QuestionType
  totalScore?: number
  perScore?: number
  items: PracticePaperItem[]
}

export type PracticePaperDetail = {
  paper: {
    id: string
    name: string
    subjectId: string
    type: DomainValue<'paperType'>
    assessmentType: string
    questionCount: number
    sections: PracticePaperSection[]
  }
  favoriteQuestionIds: string[]
  latestRecord: {
    id: string
    recordStatus: DomainValue<'recordStatus'>
    userAnswers: Record<string, string | string[]>
    score: number | null
    startTime: string | null
    endTime: string | null
  } | null
}

export type PracticeSubmission = {
  id: string
  paperId: string
  recordStatus: 'completed'
  userAnswers: Record<string, string | string[]>
  score: number | null
  startTime: string | null
  endTime: string | null
}

export type SubmitPracticePaperBody = {
  submissionId: string
  userAnswers: Record<string, string | string[]>
  /** 选填；缺失或晚于交卷时间时由服务端使用交卷时间。 */
  startTime?: string
}

export type PracticeSettings = {
  shuffleQuestions: boolean
  autoNext: boolean
  recordWrongQuestions: boolean
  autoSubmitAfterCompletion: boolean
  /** 答对自动移除错题 */
  removeMistakeOnCorrect: boolean
}

export type PracticeResultQuestionStatus = 'correct' | 'wrong' | 'unanswered' | 'pending'

export type PracticeResultQuestion = {
  id: string
  index: number
  title: string
  questionType: QuestionType
  userAnswer: string
  correctAnswer: string
  explanation?: string
  status: PracticeResultQuestionStatus
}

export type PracticeSubmissionResult = {
  submissionId: string
  paperId: string
  paperName: string
  subjectName?: string
  score?: number | null
  totalCount: number
  answeredCount: number
  correctCount: number
  wrongCount: number
  unansweredCount: number
  accuracy: number
  elapsedSeconds?: number
  submittedAt?: string
  questions: PracticeResultQuestion[]
}
