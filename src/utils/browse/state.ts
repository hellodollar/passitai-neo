export type BrowsePage = 'home' | 'favorites' | 'mistakes'
export type CollectionFilters = {
  groupBy: 'subject' | 'paper'
  sort: 'count' | 'recent'
  order: 'asc' | 'desc'
}
export type HomeSelection = { subjectCode: string; entry: string }
export type BrowseState = CollectionFilters &
  HomeSelection & {
    scrollTop: number
    subjectOrder: string[]
    hiddenSubjectCodes: string[]
  }
type Query = Record<string, unknown>
const PREFIX = 'passitai:browse:'
const memory = new Map<string, BrowseState>()
const ENTRY_TYPES = ['baseline', 'pastExam', 'mock', 'ai']

function text(value: unknown) {
  return typeof value === 'string' ? value : ''
}

export function parseCollectionFilters(
  query: Query,
  fallback?: Partial<CollectionFilters>,
): CollectionFilters {
  const groupBy = query.groupBy ?? fallback?.groupBy
  const sort = query.sort ?? fallback?.sort
  const order = query.order ?? fallback?.order
  return {
    groupBy: groupBy === 'paper' ? 'paper' : 'subject',
    sort: sort === 'count' ? 'count' : 'recent',
    order: order === 'asc' ? 'asc' : 'desc',
  }
}

export function parseHomeSelection(query: Query, fallback?: Partial<HomeSelection>): HomeSelection {
  const subjectCode = text(query.subjectCode ?? fallback?.subjectCode)
  const entry = text(query.entry ?? fallback?.entry)
  return {
    subjectCode: /^[\w-]{1,64}$/.test(subjectCode) ? subjectCode : '',
    entry: ENTRY_TYPES.includes(entry) ? entry : 'baseline',
  }
}

function normalizeState(value: unknown): BrowseState {
  const raw = value && typeof value === 'object' ? (value as Query) : {}
  const codes = (value: unknown) =>
    Array.isArray(value)
      ? [
          ...new Set(
            value.filter(
              (item): item is string => typeof item === 'string' && /^[\w-]{1,64}$/.test(item),
            ),
          ),
        ]
      : []
  return {
    ...parseCollectionFilters(raw),
    ...parseHomeSelection(raw),
    scrollTop:
      typeof raw.scrollTop === 'number' && Number.isFinite(raw.scrollTop)
        ? Math.max(0, raw.scrollTop)
        : 0,
    subjectOrder: codes(raw.subjectOrder),
    hiddenSubjectCodes: codes(raw.hiddenSubjectCodes),
  }
}

/** 只保存页面选择，不缓存接口列表或作答；按账号、页面隔离。 */
export function readBrowseState(userId: string, page: BrowsePage): BrowseState {
  const key = `${PREFIX}${userId}:${page}`
  if (!userId) return normalizeState(null)
  if (memory.has(key)) return normalizeState(memory.get(key))
  try {
    return normalizeState(JSON.parse(window.sessionStorage.getItem(key) ?? 'null'))
  } catch {
    return normalizeState(null)
  }
}

export function writeBrowseState(userId: string, page: BrowsePage, patch: Partial<BrowseState>) {
  if (!userId) return
  const key = `${PREFIX}${userId}:${page}`
  const state = normalizeState({ ...readBrowseState(userId, page), ...patch })
  memory.set(key, state)
  try {
    window.sessionStorage.setItem(key, JSON.stringify(state))
  } catch {
    // 存储不可用时，本次应用会话仍能记住页面选择。
  }
}

export function clearBrowseState(userId: string) {
  const prefix = `${PREFIX}${userId}:`
  for (const key of memory.keys()) if (key.startsWith(prefix)) memory.delete(key)
  try {
    const keys = Object.keys(window.sessionStorage).filter((key) => key.startsWith(prefix))
    for (const key of keys) window.sessionStorage.removeItem(key)
  } catch {
    // 清理失败不阻断登出，新账号仍使用独立状态。
  }
}
