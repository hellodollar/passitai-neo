import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { loadSource } from './helpers/load-source.mjs'

const { usePracticeEntriesStore } = await loadSource('stores/practice-entries.ts')
const originalFetch = globalThis.fetch
const entries = [{ type: 'baseline', name: '专项训练', children: [] }]
const envelope = value => new Response(JSON.stringify({ ok: true, data: value }), {
  headers: { 'content-type': 'application/json' },
})
let calls
beforeEach(() => {
  calls = []
  setActivePinia(createPinia())
  globalThis.fetch = async url => { calls.push(String(url)); return envelope(entries) }
})
afterEach(() => { globalThis.fetch = originalFetch })

test('目录按科目缓存并去重并发请求，和刷题计划分开', async () => {
  const store = usePracticeEntriesStore()
  const [first, second] = await Promise.all([store.load('sub-one'), store.load('sub-one')])
  assert.deepEqual(first, entries)
  assert.deepEqual(second, entries)
  await store.load('sub-one')
  assert.equal(calls.length, 1)
  await store.load('sub-two')
  assert.equal(calls.length, 2)
})

test('reset 后迟到目录不能回写，新会话可以重新读取', async () => {
  let release
  const held = new Promise(resolve => { release = resolve })
  globalThis.fetch = async () => { await held; return envelope(entries) }
  const store = usePracticeEntriesStore()
  const pending = store.load('sub-one')
  store.reset()
  release()
  assert.equal(await pending, null)
  assert.equal(store.entriesBySubjectId.size, 0)
  assert.deepEqual(await store.load('sub-one'), entries)
})
