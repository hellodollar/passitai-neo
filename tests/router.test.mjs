import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory } from 'vue-router'

import { loadSource } from './helpers/load-source.mjs'

const { createAppRouter } = await loadSource('router/index.ts')
const { resolveLoginRedirect, resolvePracticeReturn, returnToPracticeList } =
  await loadSource('utils/browse/navigation.ts')
const { useAuthStore } = await loadSource('stores/auth.ts')
const { AUTH_INVALIDATED_EVENT, STORAGE_KEYS } = await loadSource('constants/app.ts')
const originalWindow = globalThis.window
const originalDocument = globalThis.document
let router
let pinia

class MemoryStorage {
  items = new Map()
  get length() {
    return this.items.size
  }
  key(index) {
    return [...this.items.keys()][index] ?? null
  }
  getItem(key) {
    return this.items.get(key) ?? null
  }
  setItem(key, value) {
    this.items.set(key, String(value))
  }
  removeItem(key) {
    this.items.delete(key)
  }
}

function signIn() {
  const session = {
    token: 'fixture-token',
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    user: {
      id: 'usrfixture',
      email: 'fixture@example.invalid',
      role: 'user',
      status: 'enabled',
      createdAt: '2026-01-01T00:00:00Z',
    },
  }
  window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session))
  return useAuthStore()
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  })
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  pinia = createPinia()
  setActivePinia(pinia)
  router = createAppRouter(createMemoryHistory())
  // 执行真实路由与守卫，Node 测试中省略页面模板加载。
  for (const record of router.getRoutes()) {
    if (record.components) record.components.default = {}
  }
})

afterEach(() => {
  for (const store of pinia._s.values()) store.$dispose()
  globalThis.window = originalWindow
  globalThis.document = originalDocument
})

function pageProps(location) {
  const props = location.matched.at(-1).props.default
  if (typeof props === 'function') return props(location)
  return props === true ? location.params : props
}

test('首页、我的、作答与报告深链解析到明确页面，报告 ID 是路径参数', () => {
  const cases = [
    ['/', 'home'],
    ['/me', 'me'],
    ['/favorites', 'favorites'],
    ['/mistakes', 'mistakes'],
    ['/practice/papone', 'practice'],
    ['/practice/papone/result/recone', 'practice-result'],
  ]
  for (const [path, name] of cases) {
    const location = router.resolve(path)
    assert.equal(location.name, name)
  }
  assert.deepEqual(pageProps(router.resolve('/practice/papone')), {
    source: 'practice',
    paperId: 'papone',
  })
  assert.deepEqual(pageProps(router.resolve('/practice/papone/result/recone')), {
    paperId: 'papone',
    submissionId: 'recone',
  })
})

test('收藏和错题练习从路径得到来源和分组，不依赖 query 或 ID 前缀', () => {
  for (const [source, name] of [
    ['favorites', 'favorites-practice'],
    ['mistakes', 'mistakes-practice'],
  ]) {
    for (const groupBy of ['subject', 'paper']) {
      const location = router.resolve(`/${source}/practice/${groupBy}/resource-one?source=ignored`)
      assert.equal(location.name, name)
      assert.deepEqual(pageProps(location), { source, groupBy, groupId: 'resource-one' })
    }
    assert.equal(pageProps(router.resolve(`/${source}`)), false)
    assert.equal(router.resolve(`/${source}/practice/unknown/resource-one`).name, 'not-found')
  }
})

test('旧 URL 与不完整地址直接进入未找到页，没有兼容重定向', () => {
  for (const path of [
    '/practice',
    '/practice/papers/papone',
    '/practice/papers/papone/result?submissionId=recone',
    '/practice/papone/result',
    '/wrong-book',
    '/account',
    '/favorites/practice/subject',
    '/unknown',
  ]) {
    assert.equal(router.resolve(path).name, 'not-found', path)
  }
})

test('登录回跳保留真实业务页面的参数、筛选和 hash', () => {
  for (const path of [
    '/',
    '/?subjectCode=15044&entry=pastExam#subjects',
    '/me',
    '/favorites?groupBy=paper&sort=count&order=desc#list',
    '/mistakes/practice/subject/subone?returnTo=%2Fmistakes',
    '/practice/papone/result/recone',
  ]) {
    assert.equal(resolveLoginRedirect(router, path), path)
  }
})

test('登录回跳拒绝外链、非法值、访客页与未匹配地址', () => {
  for (const value of [
    undefined,
    null,
    ['/', '/me'],
    'https://evil.test/me',
    '//evil.test/me',
    '/\\evil.test',
    '/\nevil.test',
    '/me ',
    '/login?redirect=/me',
    '/register',
    '/wrong-book',
    '/account',
    '/unknown',
  ]) {
    assert.equal(resolveLoginRedirect(router, value), '/')
  }
})

test('练习返回保留入口条件，集合练习只能返回对应来源', () => {
  const favorite = '/favorites?groupBy=paper&sort=count&order=desc#list'
  const mistake = '/mistakes?groupBy=subject&sort=recent&order=asc'
  const home = '/?subjectCode=15044&entry=pastExam'
  assert.equal(resolvePracticeReturn({ returnTo: favorite }, 'favorites'), favorite)
  assert.equal(resolvePracticeReturn({ returnTo: mistake }, 'mistakes'), mistake)
  for (const target of [home, favorite, mistake]) {
    assert.equal(resolvePracticeReturn({ returnTo: target }, 'practice'), target)
  }
  assert.equal(resolvePracticeReturn({ returnTo: favorite }, 'mistakes'), '/mistakes')
  assert.equal(resolvePracticeReturn({ returnTo: mistake }, 'favorites'), '/favorites')
  assert.equal(resolvePracticeReturn({}, 'practice'), '/')
  assert.equal(resolvePracticeReturn({}, 'favorites'), '/favorites')
  assert.equal(resolvePracticeReturn({}, 'mistakes'), '/mistakes')
})

test('练习返回拒绝外链、作答循环、账户和旧地址', () => {
  for (const returnTo of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/login',
    '/account',
    '/practice/papone',
    '/favorites/practice/subject/subone',
    '/practice',
    '/wrong-book',
    ['/', '/favorites'],
  ]) {
    assert.equal(resolvePracticeReturn({ returnTo }, 'practice'), '/')
    assert.equal(resolvePracticeReturn({ returnTo }, 'mistakes'), '/mistakes')
  }
})

test('匹配来源历史时后退，直接打开或历史不匹配时替换', () => {
  const calls = []
  const history = { state: { back: '/favorites?groupBy=paper' } }
  const navigation = {
    options: { history },
    back: () => calls.push('back'),
    replace: (target) => calls.push(['replace', target]),
  }
  returnToPracticeList(navigation, '/favorites?groupBy=paper')
  history.state.back = null
  returnToPracticeList(navigation, '/mistakes')
  history.state.back = '/login'
  returnToPracticeList(navigation, '/')
  assert.deepEqual(calls, ['back', ['replace', '/mistakes'], ['replace', '/']])
})

test('列表交给内容加载后恢复滚动，其他页面使用历史位置或回到顶部', () => {
  const scroll = router.options.scrollBehavior
  const from = router.resolve('/me')
  for (const path of ['/', '/favorites', '/mistakes']) {
    assert.equal(scroll(router.resolve(path), from, null), false)
  }
  const practice = router.resolve('/practice/papone')
  const saved = { left: 0, top: 320 }
  assert.deepEqual(scroll(practice, from, saved), saved)
  assert.deepEqual(scroll(practice, from, null), { left: 0, top: 0 })
  assert.equal(scroll(router.resolve('/practice/papone?returnTo=%2F'), practice, null), false)
})

test('未登录访问业务深链时跳转登录，保留完整目标', async () => {
  const target = '/mistakes/practice/paper/papone?returnTo=%2Fmistakes#question'
  await router.push(target)
  assert.equal(router.currentRoute.value.name, 'login')
  assert.equal(router.currentRoute.value.query.redirect, target)
})

test('有效会话可访问报告，访问登录或注册时返回首页', async () => {
  signIn()
  await router.push('/practice/papone/result/recone')
  assert.equal(router.currentRoute.value.name, 'practice-result')
  for (const path of ['/login', '/register']) {
    await router.push(path)
    assert.equal(router.currentRoute.value.name, 'home')
  }
})

test('会话失效先清理身份，再跳登录并保留当前位置', async () => {
  const auth = signIn()
  const target = '/favorites?groupBy=paper&sort=count&order=desc'
  await router.push(target)
  const navigation = new Promise((resolve) => {
    const remove = router.afterEach((to) => {
      remove()
      resolve(to)
    })
  })
  window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
  assert.equal(auth.isAuthenticated, false)
  assert.equal(window.localStorage.getItem(STORAGE_KEYS.authSession), null)
  const destination = await navigation
  assert.equal(destination.name, 'login')
  assert.equal(destination.query.redirect, target)
})

test('未找到页公开可访问，会话失效不强制将公开页送到登录', async () => {
  signIn()
  await router.push('/unknown')
  assert.equal(router.currentRoute.value.name, 'not-found')
  window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
  assert.equal(useAuthStore().isAuthenticated, false)
  assert.equal(router.currentRoute.value.name, 'not-found')
})
