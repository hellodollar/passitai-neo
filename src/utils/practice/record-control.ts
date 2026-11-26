import { PRACTICE_RECORD_CHANGE_EVENT, STORAGE_KEYS } from '@/constants/app'
import type {
  PracticeRecord,
  PracticeRecordClearScope,
  PracticeRecordContext,
  PracticeRecordIdentity,
} from '@/types'

export const RECORD_PREFIX = STORAGE_KEYS.practiceRecordPrefix
const CLEAR_PREFIX = STORAGE_KEYS.practiceRecordClearPrefix
const CHANGE_EVENT = PRACTICE_RECORD_CHANGE_EVENT

export function practiceRecordKey(identity: PracticeRecordIdentity) {
  return `${RECORD_PREFIX}${encodeURIComponent(identity.userId)}:${identity.source}:${encodeURIComponent(identity.paperId)}`
}

function clearKey(scope: PracticeRecordClearScope) {
  const userId = scope.kind === 'paper' ? scope.identity.userId : scope.userId
  const prefix = `${CLEAR_PREFIX}${encodeURIComponent(userId)}:`
  if (scope.kind === 'all') return `${prefix}all`
  return `${prefix}paper:${scope.identity.source}:${encodeURIComponent(scope.identity.paperId)}`
}

/** 账号级与单题集级清理标记独立存储，避免跨标签相互覆盖。 */
export function currentPracticeClearToken(context: PracticeRecordContext) {
  const storage = window.localStorage
  const tokens = [
    storage.getItem(clearKey({ kind: 'all', userId: context.userId })) ?? '',
    storage.getItem(clearKey({ kind: 'paper', identity: context })) ?? '',
  ]
  return tokens.some(Boolean) ? JSON.stringify(tokens) : ''
}

export function isPracticeRecordCurrent(record: PracticeRecord) {
  try {
    return record.clearToken === currentPracticeClearToken(record)
  } catch {
    // 读存储失败时保留内存作答，写入仍会明确失败，不误当成已被清理。
    return true
  }
}

export function markPracticeRecordsCleared(scope: PracticeRecordClearScope) {
  const key = clearKey(scope)
  const token = crypto.randomUUID()
  window.localStorage.setItem(key, token)
  return window.localStorage.getItem(key) === token
}

export function notifyPracticeRecordChange() {
  window.dispatchEvent?.(new Event(CHANGE_EVENT))
}

/** storage 事件通知其他标签页，自定义事件通知当前页面；恢复前台时补一次同步。 */
export function subscribePracticeRecordChanges(listener: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (
      event.key === null ||
      [RECORD_PREFIX, CLEAR_PREFIX].some((prefix) => event.key!.startsWith(prefix))
    ) {
      listener()
    }
  }
  const onVisible = () => {
    if (document.visibilityState === 'visible') listener()
  }
  window.addEventListener(CHANGE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  window.addEventListener('focus', listener)
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
    window.removeEventListener('focus', listener)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
