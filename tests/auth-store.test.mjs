import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { loadSource } from './helpers/load-source.mjs'

const { useAuthStore } = await loadSource('stores/auth.ts')
const { usePracticeSettingsStore } = await loadSource('stores/practice-settings.ts')
const { usePracticePlanStore } = await loadSource('stores/practice-plan.ts')
const { STORAGE_KEYS } = await loadSource('constants/app.ts')
let pinia
const previousFetch = globalThis.fetch
const session = {
  token: 'old-session-token',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  user: {
    id: 'usrfixture',
    email: 'fixture@example.invalid',
    role: 'user',
    status: 'enabled',
    createdAt: '2026-01-01T00:00:00Z',
  },
}

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

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
    sessionStorage: new MemoryStorage(),
  })
  window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session))
  pinia = createPinia()
  setActivePinia(pinia)
})
afterEach(() => {
  for (const store of pinia._s.values()) store.$dispose()
  globalThis.fetch = previousFetch
})

test('改密码后的本地清理不再调用已经失效的 Token 登出，并清除设置与首页数据缓存', () => {
  globalThis.fetch = () => {
    throw new Error('Local session reset must not request logout')
  }
  const auth = useAuthStore()
  const practice = usePracticeSettingsStore()
  const plan = usePracticePlanStore()
  practice.isLoaded = true
  practice.settings = { autoNext: true }
  plan.isLoaded = true
  plan.plan = { majorName: '汉语言文学' }
  assert.equal(auth.isAuthenticated, true)
  auth.clearSession()
  assert.equal(auth.isAuthenticated, false)
  assert.equal(auth.session, null)
  assert.equal(auth.user, null)
  assert.equal(window.localStorage.getItem(STORAGE_KEYS.authSession), null)
  assert.equal(practice.isLoaded, false)
  assert.equal(practice.settings, null)
  assert.equal(plan.isLoaded, false)
  assert.equal(plan.plan, null)
  auth.clearSession() // repeated cleanup remains harmless
})

test('普通登出仍先带原 Token 请求服务端，即使撤销失败也清理本地会话', async () => {
  let authorization
  globalThis.fetch = async (_url, options) => {
    authorization = new Headers(options.headers).get('Authorization')
    return new Response(JSON.stringify({ ok: false, message: '撤销失败', data: null }), {
      status: 500,
      headers: { 'content-type': 'application/json' },
    })
  }
  const auth = useAuthStore()
  await auth.logout()
  assert.equal(authorization, 'Bearer ' + session.token)
  assert.equal(auth.isAuthenticated, false)
  assert.equal(window.localStorage.getItem(STORAGE_KEYS.authSession), null)
})

test('修改邮箱由账户 Store 更新唯一用户快照，不追加 GET profile', async () => {
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method })
    return new Response(JSON.stringify({ ok: true, data: { userId: session.user.id,
      email: 'updated@example.invalid' } }), { headers: { 'content-type': 'application/json' } })
  }
  const auth = useAuthStore()
  await auth.changeEmail({ password: 'fixture', newEmail: 'updated@example.invalid' })
  assert.equal(auth.user.email, 'updated@example.invalid')
  assert.equal(JSON.parse(window.localStorage.getItem(STORAGE_KEYS.authSession)).user.email,
    'updated@example.invalid')
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'PUT')
  assert.ok(requests[0].url.endsWith('/profile/email'))
})

test('修改密码由账户 Store 清理会话，不再请求资料或登出', async () => {
  const requests = []
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), method: options.method })
    return new Response(JSON.stringify({ ok: true, data: { userId: session.user.id, changed: true } }),
      { headers: { 'content-type': 'application/json' } })
  }
  const auth = useAuthStore()
  await auth.changePassword({ currentPassword: 'fixture', newPassword: 'Newfixture123' })
  assert.equal(auth.session, null)
  assert.equal(requests.length, 1)
  assert.equal(requests[0].method, 'PUT')
  assert.ok(requests[0].url.endsWith('/profile/password'))
})
