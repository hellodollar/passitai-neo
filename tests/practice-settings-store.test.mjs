import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { loadSource } from './helpers/load-source.mjs'

const { usePracticeSettingsStore } = await loadSource('stores/practice-settings.ts')

const SETTINGS = {
  autoNext: false,
  recordWrongQuestions: true,
  autoSubmitAfterCompletion: false,
  removeMistakeOnCorrect: false,
}

const previousFetch = globalThis.fetch
let requests
let handler

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

function envelope(data, { status = 200 } = {}) {
  const ok = status >= 200 && status < 300
  return new Response(JSON.stringify(ok ? { ok, data } : { ok, message: '请求失败', data }), {
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

function practice() {
  return usePracticeSettingsStore()
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { localStorage: new MemoryStorage() })
  requests = []
  handler = () => envelope(SETTINGS)
  globalThis.fetch = (url, options = {}) => {
    const href = String(url)
    const method = (options.method ?? 'GET').toUpperCase()
    const body = options.body ? JSON.parse(options.body) : undefined
    requests.push({ method, href, body })
    return handler({ method, href, body })
  }
  setActivePinia(createPinia())
})

afterEach(() => {
  globalThis.fetch = previousFetch
})

test('reset 只清设置缓存', () => {
  const store = practice()
  store.reset()
  assert.equal(store.settings, null)
  assert.equal(store.isLoaded, false)
})

test('设置 GET 缓存且并发去重', async () => {
  const store = practice()
  const [first, second] = await Promise.all([store.load(), store.load()])
  assert.deepEqual(first, SETTINGS)
  assert.deepEqual(second, SETTINGS)
  assert.equal(requests.length, 1)
  assert.equal(store.isLoaded, true)
  assert.deepEqual(store.settings, SETTINGS)

  assert.deepEqual(await store.load(), SETTINGS)
  assert.equal(requests.length, 1)
})

test('设置加载失败返回 null 且可重试', async () => {
  let calls = 0
  handler = () => {
    calls += 1
    return calls === 1 ? envelope(null, { status: 500 }) : envelope(SETTINGS)
  }
  const store = practice()
  assert.equal(await store.load(), null)
  assert.equal(store.isLoaded, false)
  assert.deepEqual(await store.load(), SETTINGS)
  assert.equal(requests.length, 2)
  assert.equal(store.isLoaded, true)
})

test('PATCH 回写缓存并返回服务端数据', async () => {
  const updated = { ...SETTINGS, autoNext: true }
  handler = ({ method }) => (method === 'PATCH' ? envelope(updated) : envelope(SETTINGS))
  const store = practice()
  const next = await store.save({ autoNext: true })
  assert.deepEqual(next, updated)
  assert.deepEqual(store.settings, updated)
  assert.equal(store.isLoaded, true)
  assert.deepEqual(requests, [
    { method: 'PATCH', href: '/api/practice/settings', body: { autoNext: true } },
  ])
})

test('reset 使在途 GET 失效，旧响应不写回', async () => {
  const pending = defer()
  handler = () => pending.promise
  const store = practice()
  const request = store.load()
  await flush()
  store.reset()
  pending.resolve(envelope(SETTINGS))
  assert.equal(await request, null)
  assert.equal(store.settings, null)
  assert.equal(store.isLoaded, false)
})

test('reset 使在途 PATCH 失效，旧响应不写回但返回值不变', async () => {
  const updated = { ...SETTINGS, autoNext: true }
  const pending = defer()
  handler = () => pending.promise
  const store = practice()
  const request = store.save({ autoNext: true })
  await flush()
  store.reset()
  pending.resolve(envelope(updated))
  assert.deepEqual(await request, updated)
  assert.equal(store.settings, null)
  assert.equal(store.isLoaded, false)
})

test('旧 GET 迟到时新请求已悬而未决，后续 load 加入新请求而非新增', async () => {
  const staleValue = { ...SETTINGS, autoNext: true }
  const freshValue = { ...SETTINGS, autoSubmitAfterCompletion: true }
  const old = defer()
  const fresh = defer()
  let gets = 0
  handler = ({ method }) => {
    if (method !== 'GET') return envelope(SETTINGS)
    gets += 1
    return gets === 1 ? old.promise : fresh.promise
  }
  const store = practice()
  const staleRequest = store.load()
  await flush()
  store.reset()

  const freshRequest = store.load()
  await flush()
  assert.equal(requests.length, 2)

  // 新请求仍挂起时完成旧请求，旧 finally 不能清掉新 pending
  old.resolve(envelope(staleValue))
  assert.equal(await staleRequest, null)

  // 再次 ensure 应加入现有新请求，不产生第三个请求
  const joined = store.load()
  assert.equal(requests.length, 2)

  fresh.resolve(envelope(freshValue))
  assert.deepEqual(await freshRequest, freshValue)
  assert.deepEqual(await joined, freshValue)
  assert.deepEqual(store.settings, freshValue)
  assert.equal(store.isLoaded, true)
})

test('新会话设置写入后旧 PATCH 返回不能覆盖新缓存', async () => {
  const oldPatchValue = { ...SETTINGS, autoNext: true }
  const freshValue = { ...SETTINGS, autoSubmitAfterCompletion: true }
  const old = defer()
  handler = ({ method }) => (method === 'PATCH' ? old.promise : envelope(freshValue))
  const store = practice()
  const patchRequest = store.save({ autoNext: true })
  await flush()
  store.reset()

  assert.deepEqual(await store.load(), freshValue)
  assert.deepEqual(store.settings, freshValue)

  old.resolve(envelope(oldPatchValue))
  assert.deepEqual(await patchRequest, oldPatchValue)
  assert.deepEqual(store.settings, freshValue)
  assert.equal(store.isLoaded, true)
})

test('PATCH 失败抛出且不伪报成功，原缓存保持', async () => {
  const store = practice()
  await store.load()
  assert.deepEqual(store.settings, SETTINGS)

  handler = () => envelope(null, { status: 500 })
  await assert.rejects(store.save({ autoNext: true }))
  assert.deepEqual(store.settings, SETTINGS)
  assert.equal(store.isLoaded, true)

  // 队列不因失败中断:后续 PATCH 仍可提交
  handler = ({ body }) => envelope({ ...SETTINGS, ...body })
  await store.save({ autoSubmitAfterCompletion: true })
  assert.deepEqual(store.settings, { ...SETTINGS, autoSubmitAfterCompletion: true })
})

test('连续 PATCH 串行提交，前一个完成后才发出下一个，顺序与调用一致', async () => {
  const first = defer()
  let patches = 0
  handler = ({ method, body }) => {
    if (method !== 'PATCH') return envelope(SETTINGS)
    patches += 1
    return patches === 1 ? first.promise : envelope({ ...SETTINGS, ...body })
  }
  const store = practice()
  const firstRequest = store.save({ autoNext: true })
  const secondRequest = store.save({ recordWrongQuestions: false })
  await flush()
  await flush()
  // 第二个 PATCH 在队列中等待,未发出
  assert.equal(requests.length, 1)

  first.resolve(envelope({ ...SETTINGS, autoNext: true }))
  await Promise.all([firstRequest, secondRequest])
  assert.deepEqual(
    requests.map((request) => request.body),
    [{ autoNext: true }, { recordWrongQuestions: false }],
  )
})

test('同会话迟到 GET 不能覆盖已经保存的 PATCH', async () => {
  const stale = defer()
  handler = ({ method }) =>
    method === 'GET' ? stale.promise : envelope({ ...SETTINGS, autoNext: true })
  const store = practice()
  const get = store.load()
  await flush()
  await store.save({ autoNext: true })
  stale.resolve(envelope(SETTINGS))
  assert.equal(await get, null)
  assert.equal(store.settings.autoNext, true)
})

test('账号切换取消尚未发出的旧 PATCH，新账号请求不等待旧队列', async () => {
  const old = defer()
  const tokens = []
  const storage = window.localStorage
  const setSession = (token) => storage.setItem('passitai:auth-session', JSON.stringify({ token }))
  setSession('account-a')
  globalThis.fetch = (_url, options) => {
    tokens.push(new Headers(options.headers).get('Authorization'))
    return tokens.length === 1 ? old.promise : envelope(SETTINGS)
  }
  const store = practice()
  const first = store.save({ autoNext: true }).catch(() => null)
  const queued = store.save({ autoSubmitAfterCompletion: true }).catch((error) => error)
  await flush()
  store.reset()
  setSession('account-b')
  await store.save({ recordWrongQuestions: false })
  assert.deepEqual(tokens, ['Bearer account-a', 'Bearer account-b'])
  old.resolve(envelope(SETTINGS))
  await first
  assert.equal((await queued).name, 'SessionChangedError')
  assert.equal(tokens.length, 2)
})

test('无 storage 事件时，排队请求也检查当前 Token', async () => {
  const old = defer()
  window.localStorage.setItem('passitai:auth-session', JSON.stringify({ token: 'a' }))
  handler = () => old.promise
  const store = practice()
  const first = store.save({ autoNext: true }).catch(() => null)
  const queued = store.save({ autoSubmitAfterCompletion: true }).catch((error) => error)
  await flush()
  window.localStorage.setItem('passitai:auth-session', JSON.stringify({ token: 'b' }))
  old.resolve(envelope(SETTINGS))
  await first
  assert.equal((await queued).name, 'SessionChangedError')
  assert.equal(requests.length, 1)
})

test('旧读取失败不能把新保存成功的设置标成加载失败', async () => {
  const old = defer()
  handler = ({ method, body }) => method === 'GET' ? old.promise : envelope({ ...SETTINGS, ...body })
  const store = practice()
  const reading = store.load()
  await flush()
  await store.save({ autoNext: true })
  old.resolve(envelope(null, { status: 503 }))
  await reading
  assert.equal(store.settings.autoNext, true)
  assert.equal(store.error, null)
  assert.equal(store.isLoaded, true)
})
