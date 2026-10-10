import { ROUTE_NAMES } from '@/constants/app'

export type BrowsePage = 'home' | 'favorites' | 'wrong-questions'
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

export function collectionFilters(
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

export function homeSelection(query: Query, fallback?: Partial<HomeSelection>): HomeSelection {
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
    ...collectionFilters(raw),
    ...homeSelection(raw),
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

/** 返回目标只允许站内三个刷题入口，拒绝外链、登录页和练习页循环。 */
export function practiceReturnTarget(query: Query, collectionMode: boolean) {
  const fallback = collectionMode
    ? query.source === 'wrong-questions'
      ? '/wrong-book'
      : '/favorites'
    : '/'
  const value = text(query.returnTo)
  try {
    if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback
    const url = new URL(value, 'https://internal.invalid')
    if (
      url.origin !== 'https://internal.invalid' ||
      !['/', '/favorites', '/wrong-book'].includes(url.pathname)
    ) {
      return fallback
    }
    if (collectionMode && url.pathname !== fallback) return fallback
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return fallback
  }
}

/** 有匹配的站内上一页时真正后退；直接打开或历史不匹配时替换，避免重复入栈。 */
export function returnFromPractice(
  router: {
    options: { history: { state: { back?: unknown } } }
    back: () => void
    replace: (target: string) => unknown
  },
  target: string,
) {
  if (router.options.history.state.back === target) router.back()
  else void router.replace(target)
}

export function isBrowseRoute(name: unknown) {
  return (
    name === ROUTE_NAMES.practiceHome ||
    name === ROUTE_NAMES.favorites ||
    name === ROUTE_NAMES.wrongQuestions
  )
}
