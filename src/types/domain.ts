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

export type UserRole = 'admin' | 'user'
export type CreatedBy = 'system' | 'user' | 'ai'

export type QuestionType = 'single' | 'multiple' | 'judge' | 'shortAnswer' | 'essay'
export type QuestionCategory = 'pastExam' | 'practice' | 'mock'
export type PaperCategory = 'pastExam' | 'practice' | 'mock'

// ---- Auth & User ----

export type User = {
  id: string
  email: string
  role: UserRole
  createdAt: string
}

export type UserProfile = User & {
  displayName: string
  avatarUrl: string
  bio: string
  examGoal: string
  placeholder?: boolean
  persisted?: boolean
}

export type UpdateProfileBody = {
  displayName?: string
  avatarUrl?: string
  bio?: string
  examGoal?: string
}

export type AuthSession = {
  token: string
  user: User
}

export type AuthCredentials = {
  email: string
  password: string
}

export type UserPreferenceStudy = {
  dailyGoal?: number
  defaultMode?: string
  questionOrder?: string
  autoNext?: boolean
  showAnswerAfterSubmit?: boolean
  majorId?: string
  subjectIds?: string[]
  subjectOrder?: string[]
  hiddenSubjectIds?: string[]
} & Record<string, unknown>

export type UserPreferences = {
  userId: string
  placeholder?: boolean
  persisted?: boolean
  study: UserPreferenceStudy
  notifications: {
    dailyReminder?: boolean
    reminderTime?: string
    weeklyReport?: boolean
  } & Record<string, unknown>
  display: {
    theme?: string
    compactMode?: boolean
  } & Record<string, unknown>
}

export type UserSettings = {
  userId: string
  placeholder?: boolean
  practice: {
    dailyGoal?: number
    questionOrder?: string
    autoNext?: boolean
    autoNextOnCorrect?: boolean
    recordWrongQuestions?: boolean
    showAnswerAfterSubmit?: boolean
  } & Record<string, unknown>
  account: {
    emailChangeEnabled?: boolean
    passwordChangeEnabled?: boolean
  } & Record<string, unknown>
  privacy?: {
    profileVisibility?: string
    showLearningStats?: boolean
  } & Record<string, unknown>
  security?: {
    activeSessions?: unknown[]
  } & Record<string, unknown>
  persisted?: boolean
}

export type UserMe = {
  user: User
  profile: UserProfile
  preferences: UserPreferences
  settings: UserSettings
  catalog?: {
    majors: Major[]
    subjects: Subject[]
  }
  editable?: Record<
    string,
    {
      method: string
      path: string
      fields: string[]
    }
  >
  placeholder?: boolean
}

export type UpdateUserPreferencesBody = Partial<{
  study: Partial<UserPreferenceStudy>
  notifications: Partial<UserPreferences['notifications']>
  display: Partial<UserPreferences['display']>
}>

export type UpdateUserSettingsBody = Partial<{
  practice: Partial<UserSettings['practice']>
  account: Partial<UserSettings['account']>
  privacy: Partial<NonNullable<UserSettings['privacy']>>
  security: Partial<NonNullable<UserSettings['security']>>
}>

// ---- Papers ----

export type PaperListItem = {
  id: string
  subjectId: string
  name: string
  paperCategory: PaperCategory
  status: 'enabled'
  createdBy: CreatedBy
  createdAt: string
}

export type PaperListQuery = {
  page?: number
  limit?: number
  keyword?: string
  subjectId?: string
  paperCategory?: PaperCategory
  createdBy?: CreatedBy
}

// ---- Questions ----

export type QuestionListItem = {
  id: string
  subjectId: string
  title: string
  questionType: QuestionType
  questionCategory: QuestionCategory
  status: 'enabled'
  createdBy: CreatedBy
  createdAt: string
}

export type QuestionListQuery = {
  page?: number
  limit?: number
  keyword?: string
  subjectId?: string
  paperId?: string
  createdBy?: CreatedBy
}

// ---- Favorites ----

export type FavoriteQuestion = {
  qid: string
  title: string
}

export type SaveFavoriteBody = {
  subjectId: string
  subjectName: string
  questions: FavoriteQuestion[]
}

export type Favorite = {
  id: string
  userId: string
  subjectId: string
  subjectName: string
  questions: FavoriteQuestion[]
  total: number
  createdAt: string
  updatedAt?: string | null
}

// ---- Wrong Questions ----

export type WrongQuestionItem = {
  qid: string
  title: string
  count: number
  userAnswer: string | string[]
}

export type SaveWrongQuestionBody = {
  subjectId: string
  subjectName: string
  wrongList: WrongQuestionItem[]
}

export type WrongQuestion = {
  id: string
  userId: string
  subjectId: string
  subjectName: string
  wrongList: WrongQuestionItem[]
  total: number
  createdAt: string
  updatedAt?: string | null
}

// ---- Catalog (mock) ----

export type Subject = {
  id: string
  name: string
  majorId: string
  majorName: string
}

export type Major = {
  id: string
  name: string
}

export type OptionItem = {
  id: string
  code: string
  name: string
}

// ---- Dashboard (mock) ----

export type DashboardTodayStats = {
  answeredCount: number
  wrongCount: number
  favoriteCount: number
  paperCount: number
}

export type SubjectProgress = {
  subjectId: string
  subjectName: string
  totalPapers: number
  completedPapers: number
  progress: number
  accent: string
}

export type TopWrongQuestion = {
  qid: string
  title: string
  wrongCount: number
  subjectName: string
}

export type DashboardSummary = {
  placeholder?: true
  todayStats: DashboardTodayStats
  subjectProgress: SubjectProgress[]
  topWrongQuestions: TopWrongQuestion[]
  weeklyVolume: number[]
}

// ---- Practice placeholders ----

export type PracticePlanSubject = {
  name: string
  code: string
}

export type PracticePlan = {
  majorName: string
  majorCode: string
  subjects: PracticePlanSubject[]
}

export type UpdatePracticePlanBody = {
  majorId: string
  majorCode?: string
  subjectIds?: string[]
}

export type PracticeMode = 'paper' | 'multi-paper' | 'subject'

export type PracticeOverview = {
  placeholder: true
  defaultMode: PracticeMode
  modes: Array<{
    key: PracticeMode | string
    name: string
    enabled: boolean
  }>
  hints: {
    paperListApi: string
    questionListApi: string
  }
}

export type CreatePracticeSessionBody = {
  mode?: PracticeMode | string
  paperId?: string
  paperIds?: string[]
}

export type PracticeSession = {
  id: string
  userId: string
  mode: string
  paperIds: string[]
  status: 'notStarted'
  placeholder: true
  persisted: false
  createdAt?: string
  questions?: unknown[]
}

// ---- Settings placeholders ----

export type UpdatePracticeSettingsBody = Partial<UserSettings['practice']>

// ---- Answer sheets ----

export type AnswerSheetListItem = {
  id: string
  paperId: string
  paperName: string
  status: string
  answeredCount: number
  totalCount: number
  updatedAt?: string | null
  createdAt: string
}

export type AnswerSheetListQuery = {
  page?: number
  limit?: number
  paperId?: string
  status?: string
}

export type PasswordChangeBody = {
  currentPassword?: string
  newPassword?: string
}

export type PasswordChangePlaceholder = {
  userId: string
  changed: false
  placeholder: true
  persisted: false
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
