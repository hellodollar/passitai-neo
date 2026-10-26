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

function envelope(data, { message, status = 200 } = {}) {
  const ok = status >= 200 && status < 300
  const body = { ok, data }
  if (message !== undefined) body.message = message
  else if (!ok) body.message = '请求失败'
  return new Response(JSON.stringify(body), {
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
    JSON.stringify({ token, user: { id: 'usr1' } }),
  )
}

function countInvalidations() {
  let events = 0
  globalThis.window.addEventListener(AUTH_INVALIDATED_EVENT, () => {
    events += 1
  })
  return () => events
}

test('业务成功不带 message，仍正常返回 data', async () => {
  handler = () => envelope({ value: 1 })
  assert.deepEqual(await request('/thing'), { value: 1 })
})

test('HTTP 2xx 接收 ok: true 的标准响应', async () => {
  handler = () => envelope({ value: 1 }, { message: '操作完成' })
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

test('成功响应的可选 message 类型错误时拒绝协议', async () => {
  for (const message of [123, null, false, {}]) {
    const body = { ok: true, message, data: {} }
    handler = () => Response.json(body)
    await assert.rejects(request('/thing'), ApiError)
  }
})

test('成功无数据时接受 data: null，不要求 message', async () => {
  handler = () => envelope(null)
  assert.equal(await request('/logout', { method: 'POST' }), null)
})

test('HTTP 200 缺少 ok、ok 类型错误或 ok: false 时拒绝协议且不清会话', async () => {
  persist('tok_existing')
  const invalidations = countInvalidations()
  const bodies = [
    { message: 'success', data: {} },
    ...[false, 0, 1, 'true', null].map((ok) => ({ ok, message: 'success', data: {} })),
  ]
  for (const body of bodies) {
    handler = () => Response.json(body)
    await assert.rejects(
      request('/thing'),
      (error) => error instanceof ApiError && error.status === null,
    )
  }
  assert.equal(storedSession().token, 'tok_existing')
  assert.equal(invalidations(), 0)
})

test('业务数据中的 false 不影响接口成功，包括答错题', async () => {
  handler = () => envelope({ isCorrect: false })
  assert.deepEqual(await request('/practice/records/recfixture/submit', { method: 'POST' }), {
    isCorrect: false,
  })
})

test('上游非 JSON 的 502 响应保留 HTTP 状态，不误清用户会话', async () => {
  persist('tok_user')
  const invalidations = countInvalidations()
  handler = () =>
    new Response('<html>upstream unavailable</html>', {
      status: 502,
      headers: { 'content-type': 'text/html' },
    })
  await assert.rejects(request('/thing'), (error) => error.status === 502)
  assert.equal(storedSession().token, 'tok_user')
  assert.equal(invalidations(), 0)
})

test('受保护接口 401 清除会话并派发一次失效事件', async () => {
  persist('tok_1')
  const invalidations = countInvalidations()
  handler = () => envelope(null, { message: '登录已过期，请重新登录', status: 401 })

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
  await assert.rejects(request('/register', { method: 'POST', body: {} }))
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

test('请求创建即捕获 Token，迟到成功不泄露到新账号界面', async () => {
  persist('tok_old')
  const pending = defer()
  handler = () => pending.promise
  const oldRequest = request('/user')
  persist('tok_new')
  await flush()
  assert.equal(requests[0].authorization, 'Bearer tok_old')
  pending.resolve(envelope({ id: 'old-user' }))
  await assert.rejects(oldRequest, (error) => error.name === 'SessionChangedError')
  assert.equal(storedSession().token, 'tok_new')
})
