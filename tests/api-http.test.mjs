import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { request, ApiError } = await loadSource('api/http.ts')
const { STORAGE_KEYS, AUTH_INVALIDATED_EVENT } = await loadSource('constants/app.ts')

const previousFetch = globalThis.fetch
const previousWindow = globalThis.window

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

function envelope(data, { code = 0, message = 'success', status = 200 } = {}) {
  return new Response(JSON.stringify({ code, message, data }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function defer() {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

let requests
let handler

beforeEach(() => {
  const window = Object.assign(new EventTarget(), { localStorage: new MemoryStorage() })
  globalThis.window = window
  requests = []
  handler = () => envelope(null)
  globalThis.fetch = (url, options = {}) => {
    const headers = new Headers(options.headers)
    requests.push({
      url: String(url),
      method: (options.method ?? 'GET').toUpperCase(),
      authorization: headers.get('Authorization'),
    })
    return handler({ url: String(url), method: (options.method ?? 'GET').toUpperCase(), headers })
  }
})

afterEach(() => {
  globalThis.fetch = previousFetch
  globalThis.window = previousWindow
})

function storedSession() {
  const raw = globalThis.window.localStorage.getItem(STORAGE_KEYS.authSession)
  return raw ? JSON.parse(raw) : null
}

function persist(token) {
  globalThis.window.localStorage.setItem(
    STORAGE_KEYS.authSession,
    JSON.stringify({ token, user: { id: 'usr_1' } }),
  )
}

function countInvalidations() {
  let events = 0
  globalThis.window.addEventListener(AUTH_INVALIDATED_EVENT, () => {
    events += 1
  })
  return () => events
}

test('业务成功返回 data', async () => {
  handler = () => envelope({ value: 1 })
  assert.deepEqual(await request('/thing'), { value: 1 })
})

test('HTTP 2xx 成功时业务码被动，不参与成败判定', async () => {
  handler = () => envelope({ value: 1 }, { code: 9999, message: 'legacy' })
  assert.deepEqual(await request('/thing'), { value: 1 })
})

test('2xx 但响应缺少统一 envelope 时抛出通用错误', async () => {
  handler = () =>
    new Response(JSON.stringify({ raw: true }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  await assert.rejects(request('/thing'), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, null)
    return true
  })
})

test('网络失败抛出网络文案且 status 为 null', async () => {
  handler = () => {
    throw new TypeError('fetch failed')
  }
  await assert.rejects(request('/thing'), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, null)
    assert.equal(error.message, '网络连接失败，请检查网络后重试')
    return true
  })
})

test('受保护接口 401 清除会话并派发一次失效事件', async () => {
  persist('tok_1')
  const invalidations = countInvalidations()
  handler = () => envelope(null, { code: 2102, message: '登录已过期，请重新登录', status: 401 })

  await assert.rejects(request('/me'), (error) => {
    assert.ok(error instanceof ApiError)
    assert.equal(error.status, 401)
    assert.equal(error.message, '登录已过期，请重新登录')
    return true
  })
  assert.equal(invalidations(), 1)
  assert.equal(storedSession(), null)
})

test('401 且无会话时不派发事件', async () => {
  const invalidations = countInvalidations()
  handler = () => envelope(null, { status: 401 })

  await assert.rejects(request('/me'))
  assert.equal(invalidations(), 0)
})

test('并发受保护请求 401 只清除并派发一次事件', async () => {
  persist('tok_1')
  const invalidations = countInvalidations()
  const first = defer()
  const second = defer()
  let calls = 0
  handler = () => {
    calls += 1
    return calls === 1 ? first.promise : second.promise
  }

  const request1 = request('/me').catch(() => null)
  const request2 = request('/me').catch(() => null)
  await flush()
  assert.equal(requests.length, 2)
  assert.equal(requests[0].authorization, 'Bearer tok_1')

  first.resolve(envelope(null, { status: 401 }))
  await request1
  second.resolve(envelope(null, { status: 401 }))
  await request2

  assert.equal(invalidations(), 1)
  assert.equal(storedSession(), null)
})

test('旧 token 的迟到 401 不会清除新登录的会话', async () => {
  persist('tok_old')
  const invalidations = countInvalidations()
  const pending = defer()
  handler = () => pending.promise

  const stale = request('/me').catch(() => null)
  await flush()
  persist('tok_new')

  pending.resolve(envelope(null, { status: 401 }))
  await stale

  assert.equal(invalidations(), 0)
  assert.equal(storedSession()?.token, 'tok_new')
})

test('公共登录/登出接口 401 不清除已有会话', async () => {
  persist('tok_existing')
  const invalidations = countInvalidations()
  handler = () => envelope(null, { status: 401 })

  await assert.rejects(request('/login', { method: 'POST', body: {} }))
  await assert.rejects(request('/logout', { method: 'POST' }))
  assert.equal(invalidations(), 0)
  assert.equal(storedSession()?.token, 'tok_existing')
})

test('显式 Authorization（登出旧 token）不被当前会话覆盖', async () => {
  persist('tok_current')
  const invalidations = countInvalidations()
  handler = () => envelope(null, { status: 401 })

  await request('/logout', {
    method: 'POST',
    headers: { Authorization: 'Bearer tok_old' },
  }).catch(() => null)

  assert.equal(requests.at(-1).authorization, 'Bearer tok_old')
  assert.equal(invalidations(), 0)
  assert.equal(storedSession()?.token, 'tok_current')
})
