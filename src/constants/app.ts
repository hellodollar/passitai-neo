export const APP_NAME = 'PassIt AI'

export const AUTH_INVALIDATED_EVENT = 'passitai:auth-invalidated'

export const STORAGE_KEYS = {
  authSession: 'passitai:auth-session',
  appPreferences: 'passitai:app-preferences',
} as const

export const DEFAULT_APP_PREFERENCES = {
  theme: 'neo',
} as const
