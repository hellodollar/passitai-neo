import type {
  PracticeRecord,
  PracticeRecordClearScope,
  PracticeRecordContext,
  PracticeRecordIdentity,
} from '@/types/practice-record'

export const RECORD_PREFIX = 'passitai:practice-record:v2:'
export const LEGACY_DRAFT_PREFIX = 'passitai:practice-draft:v1:'
const CLEAR_PREFIX = 'passitai:practice-record-clear:v1:'
const CHANGE_EVENT = 'passitai:practice-record-change'

export function practiceRecordKey(identity: PracticeRecordIdentity) {
  return `${RECORD_PREFIX}${encodeURIComponent(identity.userId)}:${identity.source}:${encodeURIComponent(identity.paperId)}`
}

export function legacyPracticeRecordKey(identity: PracticeRecordIdentity) {
  return `${LEGACY_DRAFT_PREFIX}${identity.userId}:${identity.paperId}`
}

function clearKey(scope: PracticeRecordClearScope) {
  const userId = scope.kind === 'paper' ? scope.identity.userId : scope.userId
  const prefix = `${CLEAR_PREFIX}${encodeURIComponent(userId)}:`
  if (scope.kind === 'all') return `${prefix}all`
  if (scope.kind === 'category') return `${prefix}category:${scope.paperType}`
  return `${prefix}paper:${scope.identity.source}:${encodeURIComponent(scope.identity.paperId)}`
}

/** 各作用域独立存储，避免两个标签页分别清理不同分类时覆盖对方的标记。 */
export function currentPracticeClearToken(context: PracticeRecordContext) {
  const storage = window.localStorage
  const tokens = [
    storage.getItem(clearKey({ kind: 'all', userId: context.userId })) ?? '',
    storage.getItem(clearKey({ kind: 'paper', identity: context })) ?? '',
    context.source === 'practice' && context.paperType
      ? (storage.getItem(
          clearKey({ kind: 'category', userId: context.userId, paperType: context.paperType }),
        ) ?? '')
      : '',
  ]
  return tokens.some(Boolean) ? JSON.stringify(tokens) : ''
}

export function isPracticeRecordCurrent(record: PracticeRecord) {
  try {
    return (record.clearToken ?? '') === currentPracticeClearToken(record)
  } catch {
    // 读存储失败时保留内存作答，写入仍会明确失败，不误当成已被清理。
    return true
  }
}

export function isLegacyPracticeRecordCleared(context: PracticeRecordContext) {
  if (currentPracticeClearToken(context)) return true
  if (context.source === 'practice') return false
  // v1 的收藏/错题共用一份草稿；任一来源明确清理后，残留旧键不再迁移给另一来源。
  return Boolean(
    window.localStorage.getItem(
      clearKey({
        kind: 'paper',
        identity: {
          ...context,
          source: context.source === 'favorites' ? 'wrong-questions' : 'favorites',
        },
      }),
    ),
  )
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
      [RECORD_PREFIX, LEGACY_DRAFT_PREFIX, CLEAR_PREFIX].some((prefix) =>
        event.key!.startsWith(prefix),
      )
    )
      listener()
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
