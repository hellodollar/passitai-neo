import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { loadSource } from './helpers/load-source.mjs'

const { useAuthStore } = await loadSource('stores/auth.ts')
const { usePracticeSettingsStore } = await loadSource('stores/practice-settings.ts')
const { usePracticePlanStore } = await loadSource('stores/practice-plan.ts')
const { STORAGE_KEYS, AUTH_INVALIDATED_EVENT } = await loadSource('constants/app.ts')
const originalFetch = globalThis.fetch
const originalWindow = globalThis.window
const originalDocument = globalThis.document
let pinia
let handler
let calls

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

const sessionFor = (id, expiresAt = new Date(Date.now() + 86_400_000).toISOString()) => ({
  token: 'fixture-' + id,
  expiresAt,
  user: {
    id,
    email: id + '@example.invalid',
    role: 'user',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
})
const envelope = (data) =>
  new Response(JSON.stringify({ ok: true, data }), {
    headers: { 'content-type': 'application/json' },
  })
const persist = (value) =>
  window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(value))
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
function defer() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function storageChanged() {
  window.dispatchEvent(Object.assign(new Event('storage'), { key: STORAGE_KEYS.authSession }))
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  })
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  pinia = createPinia()
  setActivePinia(pinia)
  calls = []
  handler = () => envelope(sessionFor('a').user)
  globalThis.fetch = (url, options) => {
    calls.push({ url: String(url), token: new Headers(options.headers).get('Authorization') })
    return handler(String(url), options)
  }
})
afterEach(() => {
  for (const store of pinia._s.values()) store.$dispose()
  globalThis.fetch = originalFetch
  globalThis.window = originalWindow
  globalThis.document = originalDocument
})

test('启动时过期或缺失有效期的旧会话不发身份请求，只失效一次', async () => {
  for (const expiresAt of ['2020-01-01T00:00:00Z', undefined]) {
    persist({ ...sessionFor('a'), expiresAt })
    const auth = useAuthStore()
    let invalidated = 0
    const listener = () => {
      invalidated++
    }
    window.addEventListener(AUTH_INVALIDATED_EVENT, listener)
    auth.initialize()
    await flush()
    assert.equal(auth.isAuthenticated, false)
    assert.equal(auth.session, null)
    assert.equal(calls.length, 0)
    assert.equal(invalidated, 1)
    window.removeEventListener(AUTH_INVALIDATED_EVENT, listener)
    auth.$dispose()
    pinia._s.delete('auth')
    delete pinia.state.value.auth
  }
})

test('固定有效期到时清会话，不续期，不调用网络', async () => {
  persist(sessionFor('a', new Date(Date.now() + 150).toISOString()))
  const auth = useAuthStore()
  let invalidated = 0
  window.addEventListener(AUTH_INVALIDATED_EVENT, () => {
    invalidated++
  })
  auth.initialize()
  await flush()
  const expiresAt = auth.session.expiresAt
  assert.equal(auth.isAuthenticated, true)
  await new Promise((resolve) => setTimeout(resolve, 190))
  assert.equal(auth.session, null)
  assert.equal(invalidated, 1)
  assert.equal(calls.length, 1)
  assert.ok(Date.parse(expiresAt) <= Date.now())
})

test('前台恢复核对到期，策略不改变既有绝对有效期', async () => {
  persist(sessionFor('a'))
  const auth = useAuthStore()
  auth.initialize()
  await flush()
  const originalExpiry = auth.session.expiresAt
  window.dispatchEvent(new Event('focus'))
  document.dispatchEvent(new Event('visibilitychange'))
  await flush()
  assert.equal(calls.length, 1)
  assert.equal(auth.session.expiresAt, originalExpiry)
  persist(sessionFor('a', '2020-01-01T00:00:00Z'))
  window.dispatchEvent(new Event('focus'))
  assert.equal(auth.session, null)
})

test('跨标签换账号直接同步新会话并清缓存，退出只广播一次', async () => {
  persist(sessionFor('a'))
  handler = () =>
    envelope(
      sessionFor(
        window.localStorage.getItem(STORAGE_KEYS.authSession).includes('fixture-b') ? 'b' : 'a',
      ).user,
    )
  const auth = useAuthStore()
  auth.initialize()
  await flush()
  usePracticeSettingsStore().isLoaded = true
  usePracticePlanStore().isLoaded = true
  persist(sessionFor('b'))
  storageChanged()
  await flush()
  assert.equal(auth.user.id, 'b')
  assert.equal(usePracticeSettingsStore().isLoaded, false)
  assert.equal(usePracticePlanStore().isLoaded, false)
  assert.equal(calls.length, 1)
  assert.equal(auth.session.token, 'fixture-b')
  let invalidated = 0
  window.addEventListener(AUTH_INVALIDATED_EVENT, () => {
    invalidated++
  })
  window.localStorage.removeItem(STORAGE_KEYS.authSession)
  storageChanged()
  storageChanged()
  assert.equal(auth.session, null)
  assert.equal(invalidated, 1)
})

test('另一个标签的无效新 Token 不会造成递归，当前会话安全清理', () => {
  persist(sessionFor('a'))
  const auth = useAuthStore()
  persist(sessionFor('b', '2020-01-01T00:00:00Z'))
  assert.doesNotThrow(() => auth.refreshUser())
  assert.equal(auth.session, null)
})

test('迟到的旧 refreshUser 不覆盖新登录用户，用户只有一个快照', async () => {
  persist(sessionFor('a'))
  const old = defer()
  const newSession = sessionFor('b')
  handler = (url) => (url.endsWith('/user') ? old.promise : envelope(newSession))
  const auth = useAuthStore()
  const refreshUser = auth.refreshUser()
  await flush()
  assert.equal(await auth.login({ email: 'b@example.invalid', password: 'fixture' }), true)
  old.resolve(envelope(sessionFor('a').user))
  await refreshUser
  assert.equal(auth.session.user.id, 'b')
  assert.equal(auth.user.id, 'b')
  assert.equal(auth.session.expiresAt, newSession.expiresAt)
})

test('退出请求捕获旧 Token，迟到完成不能清除新登录', async () => {
  persist(sessionFor('a'))
  const oldLogout = defer()
  handler = (url) => (url.endsWith('/logout') ? oldLogout.promise : envelope(sessionFor('b')))
  const auth = useAuthStore()
  const exiting = auth.logout()
  await flush()
  assert.equal(calls[0].token, 'Bearer fixture-a')
  await auth.login({ email: 'b@example.invalid', password: 'fixture' })
  oldLogout.resolve(envelope(null))
  await exiting
  assert.equal(auth.user.id, 'b')
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.authSession)).user.id, 'b')
})

test('身份核对的临时网络错误不清会话', async () => {
  persist(sessionFor('a'))
  handler = () => {
    throw new TypeError('offline')
  }
  const auth = useAuthStore()
  await auth.refreshUser()
  assert.equal(calls.length, 1)
  assert.equal(auth.user.id, 'a')
  assert.equal(auth.isAuthenticated, true)
})

test('错过跨标签退出事件后，回到前台仍只失效一次', async () => {
  persist(sessionFor('a'))
  const auth = useAuthStore()
  auth.initialize()
  await flush()
  let invalidated = 0
  window.addEventListener(AUTH_INVALIDATED_EVENT, () => {
    invalidated++
  })
  window.localStorage.removeItem(STORAGE_KEYS.authSession)
  window.dispatchEvent(new Event('focus'))
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(auth.session, null)
  assert.equal(invalidated, 1)
})

test('登录尚未返回时另一个标签已换账号，即使尚无事件也不能覆盖', async () => {
  const pending = defer()
  handler = () => pending.promise
  const auth = useAuthStore()
  const login = auth.login({ email: 'a@example.invalid', password: 'fixture' })
  await flush()
  persist(sessionFor('b'))
  pending.resolve(envelope(sessionFor('a')))
  assert.equal(await login, false)
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.authSession)).user.id, 'b')
})

test('更换邮箱后迟到的 refreshUser 不能覆盖新的用户快照与持久化邮箱', async () => {
  const initial = sessionFor('a')
  persist(initial)
  const old = defer()
  handler = (url) => url.endsWith('/user/email')
    ? envelope({ userId: initial.user.id, email: 'updated@example.invalid' }) : old.promise
  const auth = useAuthStore()
  auth.initialize()
  const hydration = auth.refreshUser()
  await flush()
  await auth.changeEmail({ password: 'fixture', newEmail: 'updated@example.invalid' })
  old.resolve(envelope(initial.user))
  await hydration
  assert.equal(auth.user.email, 'updated@example.invalid')
  assert.equal(auth.isAuthenticated, true)
  assert.equal(auth.session.expiresAt, initial.expiresAt)
  assert.equal(
    JSON.parse(window.localStorage.getItem(STORAGE_KEYS.authSession)).user.email,
    'updated@example.invalid',
  )
  assert.equal(calls.length, 2)
})

test('跨标签更新同一会话邮箱后，旧 refreshUser 不覆盖同步来的用户快照', async () => {
  const initial = sessionFor('a')
  persist(initial)
  const old = defer()
  handler = () => old.promise
  const auth = useAuthStore()
  auth.initialize()
  const hydration = auth.refreshUser()
  await flush()
  persist({ ...initial, user: { ...initial.user, email: 'other-tab@example.invalid' } })
  storageChanged()
  old.resolve(envelope(initial.user))
  await hydration
  assert.equal(auth.user.email, 'other-tab@example.invalid')
  assert.equal(auth.session.expiresAt, initial.expiresAt)
  assert.equal(
    JSON.parse(window.localStorage.getItem(STORAGE_KEYS.authSession)).user.email,
    'other-tab@example.invalid',
  )
})

test('initialize 幂等，前台与同会话 storage 事件都不额外查询用户', async () => {
  persist(sessionFor('a'))
  const auth = useAuthStore()
  await Promise.all([auth.initialize(), auth.initialize()])
  assert.equal(calls.length, 1)
  await auth.initialize()
  for (let count = 0; count < 3; count++) {
    window.dispatchEvent(new Event('focus'))
    document.dispatchEvent(new Event('visibilitychange'))
    storageChanged()
    await flush()
  }
  assert.equal(calls.length, 1)
})

test('新登录和注册只使用响应的用户，成功后不重复查询资料', async () => {
  handler = () => envelope(sessionFor('a'))
  const auth = useAuthStore()
  await auth.initialize()
  assert.equal(calls.length, 0)
  assert.equal(await auth.login({ email: 'a@example.invalid', password: 'fixture' }), true)
  assert.equal(calls.length, 1)
  assert.ok(calls[0].url.endsWith('/login'))
  auth.clearSession()
  assert.equal(await auth.register({ email: 'a@example.invalid', password: 'fixture' }), true)
  assert.equal(calls.length, 2)
  assert.ok(calls[1].url.endsWith('/register'))
})
