import type { DomainValue } from '@/generated/domain-values'

// ---- API envelope ----

export type ApiEnvelope<T> = {
  code: number
  message: string
  data: T | null
}

export type PaginationResult<T> = {
  items: T[]
  total: number
}

// ---- Enums ----

export type UserRole = DomainValue<'userRole'>
export type QuestionType = DomainValue<'questionType'>

// ---- Auth & User ----

export type User = {
  id: string
  email: string
  role: UserRole
  createdAt: string
}

export type AuthSession = {
  token: string
  user: User
}

export type AuthCredentials = {
  email: string
  password: string
}

export type RegisterCredentials = AuthCredentials & {
  /** 邀请码，选填：不填写可直接提交（服务端判定失败）；填写时须 6-8 位 */
  inviteCode?: string
}

export type UserMe = {
  user: User & { status: string }
  preferences: {
    /** 未设置计划时为 null，需用户手动添加 */
    plan: StudyPlan | null
    practice: PracticeSettings
    notifications: NotificationSettings
  }
}

// ---- Collection（收藏 / 错题）----

/** 收藏或错题集合来源 */
export type ReviewSource = 'favorites' | 'wrong-questions'
export type CollectionGroupBy = 'subject' | 'paper'
export type CollectionOrder = 'desc' | 'asc'

/** 聚合查询结果：groupBy=subject 或 paper */
export type Favorite = {
  id: string
  userId: string
  questionId: string
  subjectId: string
  paperId: string
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
}

export type WrongQuestion = {
  id: string
  questionId: string
  subjectId: string
  paperId: string
  title: string | null
  paperName: string | null
  createdAt: string
}

/** 收藏/记错上下文:后端按 (questionId, subjectId, paperId) 幂等收录 */
export type CollectionContext = {
  questionId: string
  subjectId: string
  paperId: string
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

/** 收藏/错题练习数据：与练习题集 paper 同构（无 type/assessmentType/latestRecord） */
export type CollectionPracticePaper = {
  paper: PracticePaperLite
}

export type PracticePaperLite = {
  id: string
  name: string
  subjectId: string
  questionCount: number
  sections: Array<{
    name: string
    questionType?: QuestionType
    items: PracticePaperItem[]
  }>
}

// ---- Catalog ----

export type OptionItem = {
  id: string
  code: string
  name: string
}

// ---- Questions ----

export type QuestionListItem = {
  id: string
  subjectId: string
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

// ---- Study plan ----

export type StudyPlanSubject = {
  name: string
  code: string
}

export type StudyPlan = {
  majorName: string
  majorCode: string
  educationLevel: DomainValue<'educationLevel'>
  nextExamDate: string | null
  subjects: StudyPlanSubject[]
}

export type UpdatePlanBody = {
  majorId: string
  majorCode?: string
  subjectIds?: string[]
}

// ---- Practice ----

export type PracticeEntryChild = {
  paperId: string
  name: string
  questionCount: number
  answeredCount: number
  /** baseline 子项的考查类型（overall / highFrequency / errorProne），其余入口不返回 */
  assessmentType?: string
}

export type PracticeEntry = {
  type: DomainValue<'paperType'>
  name: string
  description: string
  questionCount: number
  answeredCount: number
  children?: PracticeEntryChild[]
}

export type PracticePaperItem = {
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
  /** 收藏/错题练习数据携带的收录记录上下文，用于取消收藏/移除错题与记错题 */
  collectionRecordId?: string | null
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
  startTime: string
}

export type PracticeSettings = {
  autoNext: boolean
  recordWrongQuestions: boolean
  showExplanationAfterAnswer: boolean
  loopAfterCompletion: boolean
  autoSubmitAfterCompletion: boolean
  /** 答对自动移除错题 */
  removeMistakeOnCorrect: boolean
}

export type NotificationSettings = {
  dailyReminder: boolean
  reminderTime: string
  weeklyReport: boolean
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

// ---- Answer sheets ----

export type PasswordChangeBody = {
  currentPassword: string
  newPassword: string
}

export type PasswordChangeResult = {
  userId: string
  changed: boolean
}

export type EmailChangeBody = {
  password: string
  newEmail: string
}

export type EmailChangeResult = {
  userId: string
  email: string
}

// ---- App preferences (UI only) ----

export type AppPreferences = {
  theme: string
}
