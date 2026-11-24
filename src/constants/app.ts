export const APP_NAME = 'PassIt AI'

export const AUTH_INVALIDATED_EVENT = 'passitai:auth-invalidated'
export const PRACTICE_RECORD_CHANGE_EVENT = 'passitai:practice-record-change'

export const STORAGE_KEYS = {
  appearance: 'passitai:appearance',
  authSession: 'passitai:auth-session',
  browsePrefix: 'passitai:browse:',
  practiceSettingsPrefix: 'passitai:practice-settings:',
  practiceRecordPrefix: 'passitai:practice-record:',
  practiceRecordClearPrefix: 'passitai:practice-record-clear:',
} as const
