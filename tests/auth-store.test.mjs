import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { loadSource } from './helpers/load-source.mjs'

const { useAuthStore } = await loadSource('stores/auth.ts')
const { usePracticeStore } = await loadSource('stores/practice.ts')
const { usePlanStore } = await loadSource('stores/plan.ts')
const { STORAGE_KEYS } = await loadSource('constants/app.ts')
const previousFetch = globalThis.fetch
const session = { token: 'old-session-token',
  user: { id: 'usrfixture', email: 'fixture@example.invalid', role: 'user' } }

class MemoryStorage {
  items = new Map()
  get length() { return this.items.size }
  key(index) { return [...this.items.keys()][index] ?? null }
  getItem(key) { return this.items.get(key) ?? null }
  setItem(key, value) { this.items.set(key, String(value)) }
  removeItem(key) { this.items.delete(key) }
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(), sessionStorage: new MemoryStorage(),
  })
  window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session))
  setActivePinia(createPinia())
})
afterEach(() => { globalThis.fetch = previousFetch })

test('改密码后的本地清理不再调用已经失效的 Token 登出，并清除设置与首页数据缓存', () => {
  globalThis.fetch = () => { throw new Error('Local session reset must not request logout') }
  const auth = useAuthStore()
  const practice = usePracticeStore()
  const plan = usePlanStore()
  practice.settingsLoaded = true
  practice.settings = { autoNext: true }
  plan.planLoaded = true
  plan.plan = { majorName: '汉语言文学' }
  assert.equal(auth.isAuthenticated, true)
  auth.clearLocalSession()
  assert.equal(auth.isAuthenticated, false)
  assert.equal(auth.session, null)
  assert.equal(auth.user, null)
  assert.equal(window.localStorage.getItem(STORAGE_KEYS.authSession), null)
  assert.equal(practice.settingsLoaded, false)
  assert.equal(practice.settings, null)
  assert.equal(plan.planLoaded, false)
  assert.equal(plan.plan, null)
  auth.clearLocalSession() // repeated cleanup remains harmless
})

test('普通登出仍先带原 Token 请求服务端，即使撤销失败也清理本地会话', async () => {
  let authorization
  globalThis.fetch = async (_url, options) => {
    authorization = new Headers(options.headers).get('Authorization')
    return new Response(JSON.stringify({ ok: false, message: '撤销失败', data: null }),
      { status: 500, headers: { 'content-type': 'application/json' } })
  }
  const auth = useAuthStore()
  await auth.signOut()
  assert.equal(authorization, 'Bearer ' + session.token)
  assert.equal(auth.isAuthenticated, false)
  assert.equal(window.localStorage.getItem(STORAGE_KEYS.authSession), null)
})
