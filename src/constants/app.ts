export const APP_NAME = 'PassIt AI'

export const APP_TAGLINE = '刷题更稳，复习更清楚。'

export const STORAGE_KEYS = {
  authSession: 'passitai:auth-session',
  appPreferences: 'passitai:app-preferences',
  subjectSelection: 'passitai:subject-selection',
} as const

export const ROUTE_NAMES = {
  login: 'login',
  register: 'register',
  practice: 'practice',
  session: 'session',
  practiceResult: 'practice-result',
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
