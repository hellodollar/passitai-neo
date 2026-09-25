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
    plan: PracticePlan | null
    practice: PracticeSettings
    notifications: NotificationSettings
  }
}

// ---- Favorites ----

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

// ---- Wrong Questions ----

export type WrongQuestion = {
  id: string
  userId: string
  questionId: string
  subjectId: string
  paperId: string
  createdAt: string
  updatedAt?: string | null
  deletedAt?: string | null
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
  questionCategory: string
  status: string
  createdBy: string
  createdAt: string
}

// ---- Practice placeholders ----

export type PracticePlanSubject = {
  name: string
  code: string
  credits?: number | null
}

export type PracticePlan = {
  majorName: string
  majorCode: string
  educationLevel: DomainValue<'educationLevel'>
  nextExamDate: string | null
  subjects: PracticePlanSubject[]
}

export type UpdatePracticePlanBody = {
  majorId: string
  majorCode?: string
  subjectIds?: string[]
}

export type PracticeEntryChild = {
  paperId: string
  name: string
  questionCount: number
  answeredCount: number
}

export type PracticeEntry = {
  type: string
  name: string
  description: string
  questionCount: number
  answeredCount: number
  children?: PracticeEntryChild[]
}

export type PracticeAnswerSheetItem = {
  id: string
  title: string
  questionType: string
  A: string | null
  B: string | null
  C: string | null
  D: string | null
  E: string | null
  F: string | null
  correctAnswer: string
  userAnswer: string | null
  explanation: string | null
}

export type PracticeAnswerSheetGroup = {
  type: string
  label: string
  items: PracticeAnswerSheetItem[]
}

export type PracticeAnswerSheet = {
  paperId: string
  subjectId: string
  paperName: string
  recordStatus: string
  score: number
  questionGroups: PracticeAnswerSheetGroup[]
}

export type PracticeSettings = {
  autoNext: boolean
  recordWrongQuestions: boolean
  showExplanationAfterAnswer: boolean
  loopAfterCompletion: boolean
  autoSubmitAfterCompletion: boolean
}

export type NotificationSettings = {
  dailyReminder: boolean
  reminderTime: string
  weeklyReport: boolean
}

export type PracticeSubmissionAnswer = {
  questionId: string
  answer: string
  values?: string[]
}

export type SubmitPracticeSessionBody = {
  paperId: string
  subjectName?: string
  elapsedSeconds?: number
  answers: PracticeSubmissionAnswer[]
}

export type PracticeSubmitResponse = {
  id: string
  paperId: string
  status: 'submitted'
  submittedAt: string
  placeholder?: boolean
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
  placeholder?: boolean
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
  sidebarCollapsed: boolean
  reducedMotion: boolean
}

export type SubjectSelection = {
  majorId: string
  subjectIds: string[]
}
