import type { Router } from 'vue-router'

import type { PracticeSource } from '@/types'

const INTERNAL_ORIGIN = 'https://internal.invalid'

function internalUrl(value: unknown): URL | null {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\') ||
    Array.from(value).some((character) => {
      const code = character.charCodeAt(0)
      return code <= 32 || code === 127
    })
  )
    return null
  try {
    const url = new URL(value, INTERNAL_ORIGIN)
    return url.origin === INTERNAL_ORIGIN ? url : null
  } catch {
    return null
  }
}

/** 登录与注册共用回跳规则，只接受实际存在的站内业务页面。 */
export function resolveLoginRedirect(router: Router, value: unknown): string {
  const url = internalUrl(value)
  if (!url) return '/'
  const target = router.resolve(`${url.pathname}${url.search}${url.hash}`)
  if (
    !target.matched.length ||
    target.name === 'not-found' ||
    target.name === 'login' ||
    target.name === 'register'
  )
    return '/'
  return target.fullPath
}

/** 返回对应练习入口并保留筛选，禁止外链、作答循环及集合来源串用。 */
export function resolvePracticeReturn(
  query: Record<string, unknown>,
  source: PracticeSource,
): string {
  const fallback = source === 'practice' ? '/' : `/${source}`
  const url = internalUrl(query.returnTo)
  if (!url) return fallback
  const path = url.pathname
  if (!['/', '/favorites', '/mistakes'].includes(path)) return fallback
  if (source !== 'practice' && path !== fallback) return fallback
  return `${path}${url.search}${url.hash}`
}

/** 来源与历史匹配时后退；直开或历史不匹配时替换，避免重复入栈。 */
export function returnToPracticeList(router: Router, target: string) {
  if (router.options.history.state.back === target) router.back()
  else void router.replace(target)
}
