import type { DomainValue } from '@/generated/domain-values'

// ---- Enums ----

export type QuestionType = DomainValue<'questionType'>

// ---- Collection（收藏 / 错题）----

/** 收藏或错题集合来源 */
export type ReviewSource = 'favorites' | 'wrong-questions'
export type CollectionGroupBy = 'subject' | 'paper'
export type CollectionOrder = 'desc' | 'asc'

/** 收藏/记错请求携带题目、科目及发生题集；同一用户同题只收录一条。 */
export type CollectionContext = {
  questionId: string
  subjectId: string
  paperId: string
}

/** 收藏成功返回当前有效记录 ID，重新收藏后不能沿用已删除的 ID。 */
export type FavoriteMutationResult = {
  favId: string
}

export type CollectionAggregate = {
  items: CollectionAggregateItem[]
  totalQuestionCount: number
}

export type CollectionAggregateItem = {
  subjectId: string
  subjectName: string
  questionCount: number
  /** 该组最近一次收录时间 */
  lastCollectedAt: string
  /** 仅 groupBy=paper 时返回 */
  paperId?: string
  paperName?: string
}

// ---- Catalog ----

export type OptionItem = {
  id: string
  code: string
  name: string
}

// ---- Questions ----

/** 题目内容字段；API 题集题目与练习页题目视图共用同一来源，避免字段漂移。 */
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

// ---- Settings (non-practice) ----

export type NotificationSettings = {
  dailyReminder: boolean
  reminderTime: string
  weeklyReport: boolean
}

// ---- App preferences (UI only) ----

export type AppPreferences = {
  theme: string
}
