export const APP_NAME = 'Banana Neo'

export const APP_TAGLINE = '刷题更稳，复习更清楚。'

export const STORAGE_KEYS = {
  authSession: 'banana-neo:auth-session',
  appPreferences: 'banana-neo:app-preferences',
  subjectSelection: 'banana-neo:subject-selection',
} as const

export const ROUTE_NAMES = {
  login: 'login',
  register: 'register',
  dashboard: 'dashboard',
  practice: 'practice',
  session: 'session',
  favorites: 'favorites',
  wrongQuestions: 'wrong-book',
  settings: 'settings',
} as const

export const DEFAULT_APP_PREFERENCES = {
  theme: 'neo',
  sidebarCollapsed: false,
  reducedMotion: false,
} as const

export const DEFAULT_SUBJECT_SELECTION = {
  majorId: '',
  subjectIds: [] as string[],
} as const

export const PAPER_CATEGORY_LABELS = {
  pastExam: '历年真题',
  practice: '专项练习',
  mock: '模拟卷',
} as const
