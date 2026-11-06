import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'
import ts from 'typescript'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

import { loadSource } from './helpers/load-source.mjs'

const favorites = await loadSource('api/favorites.ts')
const mistakes = await loadSource('api/mistakes.ts')
const authStore = await loadSource('stores/auth.ts')
const { STORAGE_KEYS } = await loadSource('constants/app.ts')
const previousWindow = globalThis.window
const previousFetch = globalThis.fetch
let pinia, apps, calls, notices, handler

// 执行真实 SFC 的 setup 与生命周期；这里只替换界面和提示，请求仍经过项目 API。
const { descriptor } = parse(
  readFileSync(
    new URL('../src/components/collection/ClearCollectionDialog.vue', import.meta.url),
    'utf8',
  ),
)
const script = compileScript(descriptor, { id: 'clear-collection-test' })
const { outputText } = ts.transpileModule(script.content, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
})
const dependencies = {
  vue,
  '@/api/favorites': favorites,
  '@/api/mistakes': mistakes,
  '@/stores/auth': authStore,
  '@/components/common/BaseDialog.vue': {},
  '@/utils/toast': {
    showErrorToast: (message) => notices.push(['error', message]),
    showSuccessToast: (message) => notices.push(['success', message]),
  },
}
const module = { exports: {} }
new Function('require', 'module', 'exports', outputText)(
  (name) => {
    assert.ok(name in dependencies, `未配置的组件依赖：${name}`)
    return dependencies[name]
  },
  module,
  module.exports,
)
const ClearCollectionDialog = { ...module.exports.default, render: () => null }
const renderer = vue.createRenderer({
  createComment: () => ({}),
  insert: (node, parent) => (node.parent = parent),
  remove: () => {},
  parentNode: (node) => node.parent,
  nextSibling: () => null,
})

const response = (status = 200) =>
  new Response(JSON.stringify({ ok: status === 200, data: null }), {
    status,
    headers: { 'content-type': 'application/json' },
  })
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}

function signIn(id = 'first') {
  const session = {
    token: `fixture-${id}`,
    expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
    user: {
      id: `usr${id}`,
      email: `${id}@example.invalid`,
      role: 'user',
      status: 'enabled',
      createdAt: '2026-01-01T00:00:00Z',
    },
  }
  window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session))
  authStore.useAuthStore().session = session
}

function mount(sourceValue = 'favorites') {
  const open = vue.ref(true)
  const source = vue.ref(sourceValue)
  let cleared = 0
  const app = renderer.createApp({
    setup: () => () =>
      vue.h(ClearCollectionDialog, {
        modelValue: open.value,
        source: source.value,
        'onUpdate:modelValue': (value) => (open.value = value),
        onCleared: () => cleared++,
      }),
  })
  app.use(pinia)
  app.mount({})
  apps.push(app)
  const state = app._instance.subTree.component.setupState
  return { app, open, source, state, cleared: () => cleared }
}

beforeEach(() => {
  const storage = new Map()
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key),
    },
  })
  pinia = createPinia()
  setActivePinia(pinia)
  apps = []
  calls = []
  notices = []
  handler = () => response()
  globalThis.fetch = (url, options) => {
    calls.push({
      url: String(url),
      method: options.method,
      token: new Headers(options.headers).get('Authorization'),
    })
    return handler()
  }
  signIn()
})

afterEach(() => {
  apps.forEach((app) => app.unmount())
  for (const store of pinia._s.values()) store.$dispose()
  globalThis.window = previousWindow
  globalThis.fetch = previousFetch
})

for (const [source, path, label] of [
  ['favorites', '/favorites/all', '收藏'],
  ['mistakes', '/wrong-questions/all', '错题'],
]) {
  test(`确认清空${label}只删除对应集合，成功后关闭并通知刷新`, async () => {
    const dialog = mount(source)
    assert.equal(calls.length, 0)
    await dialog.state.confirmClear()
    assert.deepEqual(calls, [
      { url: `/api${path}`, method: 'DELETE', token: 'Bearer fixture-first' },
    ])
    assert.equal(dialog.open.value, false)
    assert.equal(dialog.cleared(), 1)
    assert.deepEqual(notices, [['success', `${label}已清空`]])
  })
}

test('取消不发送清空请求，关闭状态不能提交', async () => {
  const dialog = mount()
  dialog.open.value = false
  await vue.nextTick()
  await dialog.state.confirmClear()
  assert.equal(calls.length, 0)
  assert.equal(dialog.cleared(), 0)
  assert.deepEqual(notices, [])
})

test('请求中重复确认只发送一次，失败保留确认框并允许重试', async () => {
  const pending = deferred()
  handler = () => pending.promise
  const dialog = mount()
  const first = dialog.state.confirmClear()
  await dialog.state.confirmClear()
  assert.equal(dialog.state.clearing, true)
  assert.equal(calls.length, 1)
  pending.resolve(response(400))
  await first
  assert.equal(dialog.open.value, true)
  assert.equal(dialog.state.clearing, false)
  assert.equal(dialog.cleared(), 0)
  assert.deepEqual(notices, [['error', '清空失败，请稍后重试。']])
  handler = () => response()
  await dialog.state.confirmClear()
  assert.equal(calls.length, 2)
  assert.equal(dialog.cleared(), 1)
  assert.equal(dialog.open.value, false)
})

for (const status of [200, 400]) {
  test(`换账号后忽略旧清空请求的${status === 200 ? '成功' : '失败'}响应`, async () => {
    const pending = deferred()
    handler = () => pending.promise
    const dialog = mount()
    const first = dialog.state.confirmClear()
    signIn('second')
    await vue.nextTick()
    assert.equal(dialog.open.value, false)
    dialog.open.value = true
    await vue.nextTick()
    pending.resolve(response(status))
    await first
    assert.equal(dialog.open.value, true)
    assert.equal(dialog.cleared(), 0)
    assert.equal(dialog.state.clearing, false)
    assert.deepEqual(notices, [])
  })
}

test('切换收藏与错题后旧响应不能关闭新确认框', async () => {
  const pending = deferred()
  handler = () => pending.promise
  const dialog = mount()
  const first = dialog.state.confirmClear()
  dialog.source.value = 'mistakes'
  await vue.nextTick()
  assert.equal(dialog.open.value, false)
  dialog.open.value = true
  await vue.nextTick()
  pending.resolve(response())
  await first
  assert.equal(dialog.open.value, true)
  assert.equal(dialog.cleared(), 0)
  assert.deepEqual(notices, [])
  handler = () => response()
  await dialog.state.confirmClear()
  assert.equal(calls[1].url, '/api/wrong-questions/all')
  assert.equal(dialog.cleared(), 1)
})

test('离页后的清空响应不能发出刷新事件或提示', async () => {
  const pending = deferred()
  handler = () => pending.promise
  const dialog = mount()
  const first = dialog.state.confirmClear()
  dialog.app.unmount()
  apps = []
  pending.resolve(response())
  await first
  assert.equal(dialog.cleared(), 0)
  assert.deepEqual(notices, [])
})
