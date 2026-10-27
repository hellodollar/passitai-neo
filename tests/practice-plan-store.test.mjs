import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { loadSource } from './helpers/load-source.mjs'

const { usePracticePlanStore } = await loadSource('stores/practice-plan.ts')

const previousFetch = globalThis.fetch
const planFixture = {
  majorId: 'maj-1',
  majorName: '汉语言文学',
  majorCode: 'maj-c',
  subjects: [{ id: 'sub-id-1', code: 'sub-1', name: '科目一' }],
}

function jsonResponse(data) {
  return new Response(JSON.stringify({ ok: true, data }), {
    headers: { 'content-type': 'application/json' },
  })
}

let calls = []

beforeEach(() => {
  calls = []
  globalThis.fetch = async (url) => {
    const path = String(url).split('?')[0]
    calls.push(path)
    if (path === '/api/options/majors') {
      return jsonResponse([{ id: 'maj-1', code: 'maj-c', name: '汉语言文学' }])
    }
    if (path === '/api/options/subjects') {
      return jsonResponse([{ id: 'sub-id-1', code: 'sub-1', name: '科目一' }])
    }
    if (path === '/api/practice/entries') return jsonResponse(entriesFixture)
    if (path === '/api/practice/plan') return jsonResponse(planFixture)
    throw new Error('unexpected request: ' + path)
  }
  setActivePinia(createPinia())
})
afterEach(() => {
  globalThis.fetch = previousFetch
})

test('load 并发去重,加载成功后重复调用不再请求', async () => {
  const store = usePracticePlanStore()
  const [first, second] = await Promise.all([store.load(), store.load()])
  assert.deepEqual(first, planFixture)
  assert.deepEqual(second, planFixture)
  assert.equal(calls.filter((path) => path === '/api/practice/plan').length, 1)
  await store.load()
  assert.equal(calls.filter((path) => path === '/api/practice/plan').length, 1)
  assert.equal(store.isLoaded, true)
})

test('plan supplies IDs directly without options requests', async () => {
  const store = usePracticePlanStore()
  const plan = await store.load()
  assert.equal(plan.majorId, 'maj-1')
  assert.equal(plan.subjects[0].id, 'sub-id-1')
  assert.deepEqual(calls, ['/api/practice/plan'])
})

test('reset 作废旧读取，不允许旧账号计划写回缓存', async () => {
  let release
  const held = new Promise(resolve => { release = resolve })
  globalThis.fetch = async () => { await held; return jsonResponse(planFixture) }
  const store = usePracticePlanStore()
  const pending = store.load()
  store.reset()
  release()
  assert.equal(await pending, null)
  assert.equal(store.plan, null)
  assert.equal(store.isLoaded, false)
})

test('save 返回的新计划作废在途读取，迟到响应不能覆盖保存结果', async () => {
  let release
  const held = new Promise(resolve => { release = resolve })
  const updated = { ...planFixture, majorName: '新专业' }
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'PUT') return jsonResponse(updated)
    await held
    return jsonResponse(planFixture)
  }
  const store = usePracticePlanStore()
  const pending = store.load()
  await store.save({ majorId: 'maj-1', subjectIds: ['sub-id-1'] })
  release()
  assert.equal(await pending, null)
  assert.equal(store.plan.majorName, '新专业')
  assert.equal(store.isLoaded, true)
  assert.equal(store.isLoading, false)
})

test('load 失败保留错误并允许重试，成功后缓存空计划', async () => {
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, message: '失败', data: null }),
    { status: 500 })
  const store = usePracticePlanStore()
  assert.equal(await store.load(), null)
  assert.equal(store.isLoaded, false)
  assert.equal(store.error, '刷题计划加载失败')
  globalThis.fetch = async () => jsonResponse(null)
  assert.equal(await store.load(), null)
  assert.equal(store.isLoaded, true)
  assert.equal(store.error, null)
})

test('save 失败不覆盖已经加载的计划', async () => {
  const store = usePracticePlanStore()
  await store.load()
  globalThis.fetch = async () => new Response(JSON.stringify({ ok: false, message: '冲突', data: null }),
    { status: 409 })
  await assert.rejects(store.save({ majorId: 'maj-1', subjectIds: [] }))
  assert.deepEqual(store.plan, planFixture)
})
