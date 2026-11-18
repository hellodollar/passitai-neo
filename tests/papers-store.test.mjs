import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { loadSource } from './helpers/load-source.mjs'

const { usePapersStore } = await loadSource('stores/papers.ts')
const { fetchSubjectOptions } = await loadSource('api/options.ts')
const originalFetch = globalThis.fetch
const papers = { total: 1, items: [{ id: 'pap000000000001', name: '考点题集' }] }
const envelope = (value) =>
  new Response(JSON.stringify({ ok: true, data: value }), {
    headers: { 'content-type': 'application/json' },
  })
let calls

beforeEach(() => {
  calls = []
  setActivePinia(createPinia())
  globalThis.fetch = async (url) => {
    calls.push(new URL(String(url), 'http://example.invalid'))
    return envelope(papers)
  }
})
afterEach(() => {
  globalThis.fetch = originalFetch
})

test('同科目、页码和类型共用在途请求与已加载页', async () => {
  const store = usePapersStore()
  const [first, second] = await Promise.all([store.load('GD-15043', 1), store.load('GD-15043', 1)])
  assert.deepEqual(first, papers)
  assert.deepEqual(second, papers)
  await store.load('GD-15043', 1)
  assert.equal(calls.length, 1)
  await store.load('HN-15043', 1)
  await store.load('GD-15043', 2)
  await store.load('GD-15043', 1, 'highFrequency')
  assert.deepEqual(
    calls.map((call) => call.pathname),
    Array(4).fill('/api/papers'),
  )
  assert.deepEqual(
    calls.map((call) => Object.fromEntries(call.searchParams)),
    [
      { subjectCode: 'GD-15043', page: '1', limit: '20' },
      { subjectCode: 'HN-15043', page: '1', limit: '20' },
      { subjectCode: 'GD-15043', page: '2', limit: '20' },
      { subjectCode: 'GD-15043', page: '1', limit: '20', type: 'highFrequency' },
    ],
  )
})

test('重置后迟到题集不能缓存，新会话会重新查询', async () => {
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  globalThis.fetch = async () => {
    await held
    return envelope(papers)
  }
  const store = usePapersStore()
  const pending = store.load('GD-15043', 1)
  store.reset()
  release()
  assert.equal(await pending, null)
  assert.deepEqual(await store.load('GD-15043', 1), papers)
})

test('题集加载失败可重试，失败不会变成空目录', async () => {
  const store = usePapersStore()
  const successfulFetch = globalThis.fetch
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, message: '加载失败', data: null }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    })
  await assert.rejects(store.load('GD-15043', 1), /加载失败/)
  globalThis.fetch = successfulFetch
  assert.deepEqual(await store.load('GD-15043', 1), papers)
})

test('科目选项以省份和专业代码读取完整分页', async () => {
  globalThis.fetch = async (url) => {
    const call = new URL(String(url), 'http://example.invalid')
    calls.push(call)
    const page = Number(call.searchParams.get('page'))
    return envelope({
      total: 101,
      items: Array.from({ length: page === 1 ? 100 : 1 }, (_, index) => ({
        code: 'GD-' + (page * 10000 + index),
      })),
    })
  }
  const items = await fetchSubjectOptions('120206', '440000')
  assert.equal(items.length, 101)
  assert.equal(items[100].code, 'GD-20000')
  assert.deepEqual(
    calls.map((call) => call.pathname),
    ['/api/subjects', '/api/subjects'],
  )
  assert.deepEqual(
    calls.map((call) => Object.fromEntries(call.searchParams)),
    [
      { provinceCode: '440000', majorCode: '120206', page: '1', limit: '100' },
      { provinceCode: '440000', majorCode: '120206', page: '2', limit: '100' },
    ],
  )
})
