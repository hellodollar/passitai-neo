import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { loadSource } from './helpers/load-source.mjs'

const { useNotificationsStore } = await loadSource('stores/notifications.ts')
const { useAuthStore } = await loadSource('stores/auth.ts')
const { STORAGE_KEYS } = await loadSource('constants/app.ts')
const originalFetch = globalThis.fetch
const session = {
  token: 'user-a',
  expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
  user: {
    id: 'usr000000000001',
    email: 'test@example.invalid',
    role: 'user',
    status: 'enabled',
    createdAt: '2026-01-01',
  },
}
const summary = (count) => ({
  unreadCount: count,
  latestUnread: count
    ? {
        id: 'ntf000000000001',
        title: '真实消息',
        publishedAt: '2026-11-01T00:00:00Z',
      }
    : null,
})
const envelope = (data) =>
  new Response(JSON.stringify({ ok: true, data }), {
    headers: { 'content-type': 'application/json' },
  })
function deferred() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
let pinia
beforeEach(() => {
  const storage = new Map()
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => storage.delete(key),
    },
  })
  window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session))
  pinia = createPinia()
  setActivePinia(pinia)
})
afterEach(() => {
  for (const store of pinia._s.values()) store.$dispose()
  globalThis.fetch = originalFetch
})

test('all entries share one summary and concurrent refreshes are deduplicated', async () => {
  let requests = 0
  globalThis.fetch = async () => {
    requests++
    return envelope(summary(3))
  }
  const store = useNotificationsStore()
  await Promise.all([store.refresh(), store.refresh(), store.refresh()])
  assert.equal(requests, 1)
  assert.equal(store.unreadCount, 3)
  await store.refresh()
  assert.equal(requests, 1)
})

test('foreground checks share a five-minute interval even when the last check failed', async (t) => {
  const oldDocument = globalThis.document
  const foreground = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  globalThis.document = foreground
  let now = Date.now()
  t.mock.method(Date, 'now', () => now)
  let requests = 0
  globalThis.fetch = async () => {
    if (++requests === 1) throw new Error('offline')
    return envelope(summary(1))
  }
  const store = useNotificationsStore()
  try {
    store.start()
    await store.refresh()
    assert.equal(requests, 1)
    now += 60_000
    window.dispatchEvent(new Event('focus'))
    foreground.dispatchEvent(new Event('visibilitychange'))
    assert.equal(requests, 1)
    now += 240_000
    foreground.visibilityState = 'hidden'
    window.dispatchEvent(new Event('focus'))
    assert.equal(requests, 1)
    foreground.visibilityState = 'visible'
    foreground.dispatchEvent(new Event('visibilitychange'))
    window.dispatchEvent(new Event('focus'))
    assert.equal(requests, 2)
    await store.refresh()
    assert.equal(store.unreadCount, 1)
  } finally {
    store.stop()
    globalThis.document = oldDocument
  }
})

test('account reset invalidates late responses and new account can refresh immediately', async () => {
  const held = deferred()
  globalThis.fetch = () => held.promise
  const store = useNotificationsStore(),
    oldRequest = store.refresh()
  store.reset()
  window.localStorage.setItem(
    STORAGE_KEYS.authSession,
    JSON.stringify({ ...session, token: 'user-b' }),
  )
  globalThis.fetch = async () => envelope(summary(1))
  await store.refresh()
  held.resolve(envelope(summary(99)))
  await oldRequest
  assert.equal(store.unreadCount, 1)
})

test('read invalidates an older in-flight summary and reloads confirmed counts', async () => {
  const held = deferred()
  let reads = 0
  globalThis.fetch = async (url) => {
    if (String(url).endsWith('/read')) {
      return envelope({ id: 'ntf000000000001', readAt: '2026-11-11T00:00:00Z' })
    }
    if (++reads === 1) return held.promise
    return envelope(summary(0))
  }
  const store = useNotificationsStore(),
    oldRequest = store.refresh()
  await store.markRead('ntf000000000001')
  assert.equal(store.unreadCount, 0)
  held.resolve(envelope(summary(12)))
  await oldRequest
  assert.equal(store.unreadCount, 0)
})

test('failed read does not invent a successful local read or clear known counts', async () => {
  globalThis.fetch = async () => envelope(summary(2))
  const store = useNotificationsStore()
  await store.refresh()
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, data: null, message: 'fixture unavailable' }), {
      status: 409,
    })
  await assert.rejects(store.markAllRead())
  assert.equal(store.unreadCount, 2)
  await store.refresh(true)
  assert.equal(store.unreadCount, 2)
})

test('logout clears notification cache together with the current account', async () => {
  globalThis.fetch = async () => envelope(summary(5))
  const auth = useAuthStore(),
    store = useNotificationsStore()
  await store.refresh()
  auth.clearSession()
  assert.equal(store.summary, null)
  assert.equal(store.unreadCount, 0)
})
