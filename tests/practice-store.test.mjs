import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { loadSource } from './helpers/load-source.mjs'

const { usePracticeStore } = await loadSource('stores/practice.ts')

const SETTINGS = {
  autoNext: false,
  recordWrongQuestions: true,
  showExplanationAfterAnswer: true,
  loopAfterCompletion: false,
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

function envelope(data, { code = 0, status = 200 } = {}) {
  return new Response(
    JSON.stringify({ code, message: code === 0 ? 'success' : '请求失败', data }),
    { status, headers: { 'content-type': 'application/json' } },
  )
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
  return usePracticeStore()
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

test('练习运行态开始与结束', () => {
  const store = practice()
  assert.equal(store.sessionActive, false)
  store.startSession()
  assert.equal(store.sessionActive, true)
  store.endSession()
  assert.equal(store.sessionActive, false)
})

test('设置 GET 缓存且并发去重', async () => {
  const store = practice()
  const [first, second] = await Promise.all([store.ensureSettings(), store.ensureSettings()])
  assert.deepEqual(first, SETTINGS)
  assert.deepEqual(second, SETTINGS)
  assert.equal(requests.length, 1)
  assert.equal(store.settingsLoaded, true)
  assert.deepEqual(store.settings, SETTINGS)

  assert.deepEqual(await store.ensureSettings(), SETTINGS)
  assert.equal(requests.length, 1)
})

test('设置加载失败返回 null 且可重试', async () => {
  let calls = 0
  handler = () => {
    calls += 1
    return calls === 1 ? envelope(null, { status: 500 }) : envelope(SETTINGS)
  }
  const store = practice()
  assert.equal(await store.ensureSettings(), null)
  assert.equal(store.settingsLoaded, false)
  assert.deepEqual(await store.ensureSettings(), SETTINGS)
  assert.equal(requests.length, 2)
  assert.equal(store.settingsLoaded, true)
})

test('PATCH 回写缓存并返回服务端数据', async () => {
  const updated = { ...SETTINGS, autoNext: true }
  handler = ({ method }) => (method === 'PATCH' ? envelope(updated) : envelope(SETTINGS))
  const store = practice()
  const next = await store.patchSettings({ autoNext: true })
  assert.deepEqual(next, updated)
  assert.deepEqual(store.settings, updated)
  assert.equal(store.settingsLoaded, true)
  assert.deepEqual(requests, [
    { method: 'PATCH', href: '/api/practice/settings', body: { autoNext: true } },
  ])
})

test('clearSettings 使在途 GET 失效，旧响应不写回', async () => {
  const pending = defer()
  handler = () => pending.promise
  const store = practice()
  const request = store.ensureSettings()
  await flush()
  store.clearSettings()
  pending.resolve(envelope(SETTINGS))
  assert.equal(await request, null)
  assert.equal(store.settings, null)
  assert.equal(store.settingsLoaded, false)
})

test('clearSettings 使在途 PATCH 失效，旧响应不写回但返回值不变', async () => {
  const updated = { ...SETTINGS, autoNext: true }
  const pending = defer()
  handler = () => pending.promise
  const store = practice()
  const request = store.patchSettings({ autoNext: true })
  await flush()
  store.clearSettings()
  pending.resolve(envelope(updated))
  assert.deepEqual(await request, updated)
  assert.equal(store.settings, null)
  assert.equal(store.settingsLoaded, false)
})

test('旧 GET 迟到时新请求已悬而未决，后续 ensureSettings 加入新请求而非新增', async () => {
  const staleValue = { ...SETTINGS, autoNext: true }
  const freshValue = { ...SETTINGS, loopAfterCompletion: true }
  const old = defer()
  const fresh = defer()
  let gets = 0
  handler = ({ method }) => {
    if (method !== 'GET') return envelope(SETTINGS)
    gets += 1
    return gets === 1 ? old.promise : fresh.promise
  }
  const store = practice()
  const staleRequest = store.ensureSettings()
  await flush()
  store.clearSettings()

  const freshRequest = store.ensureSettings()
  await flush()
  assert.equal(requests.length, 2)

  // 新请求仍挂起时完成旧请求，旧 finally 不能清掉新 pending
  old.resolve(envelope(staleValue))
  assert.equal(await staleRequest, null)

  // 再次 ensure 应加入现有新请求，不产生第三个请求
  const joined = store.ensureSettings()
  assert.equal(requests.length, 2)

  fresh.resolve(envelope(freshValue))
  assert.deepEqual(await freshRequest, freshValue)
  assert.deepEqual(await joined, freshValue)
  assert.deepEqual(store.settings, freshValue)
  assert.equal(store.settingsLoaded, true)
})

test('新会话设置写入后旧 PATCH 返回不能覆盖新缓存', async () => {
  const oldPatchValue = { ...SETTINGS, autoNext: true }
  const freshValue = { ...SETTINGS, loopAfterCompletion: true }
  const old = defer()
  handler = ({ method }) => (method === 'PATCH' ? old.promise : envelope(freshValue))
  const store = practice()
  const patchRequest = store.patchSettings({ autoNext: true })
  await flush()
  store.clearSettings()

  assert.deepEqual(await store.ensureSettings(), freshValue)
  assert.deepEqual(store.settings, freshValue)

  old.resolve(envelope(oldPatchValue))
  assert.deepEqual(await patchRequest, oldPatchValue)
  assert.deepEqual(store.settings, freshValue)
  assert.equal(store.settingsLoaded, true)
})

test('clearSettings 只清设置缓存，不改变练习运行态', () => {
  const store = practice()
  store.startSession()
  store.clearSettings()
  assert.equal(store.sessionActive, true)
  assert.equal(store.settings, null)
  assert.equal(store.settingsLoaded, false)
})

test('PATCH 失败抛出且不伪报成功，原缓存保持', async () => {
  const store = practice()
  await store.ensureSettings()
  assert.deepEqual(store.settings, SETTINGS)

  handler = () => envelope(null, { status: 500 })
  await assert.rejects(store.patchSettings({ autoNext: true }))
  assert.deepEqual(store.settings, SETTINGS)
  assert.equal(store.settingsLoaded, true)
})
