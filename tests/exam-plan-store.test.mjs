import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { loadSource } from './helpers/load-source.mjs'

const { useExamPlanStore } = await loadSource('stores/exam-plan.ts')

const previousFetch = globalThis.fetch
const examPlanFixture = {
  provinceCode: '440000',
  majorCode: '120206',
  major: { id: 'maj-1', code: '120206', name: '人力资源管理', educationLevel: '本科' },
  subjectCodes: ['GD-15043'],
  subjects: [{ id: 'sub-id-1', code: 'GD-15043', name: '科目一', nextExam: null }],
  nextExam: null,
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
    if (path === '/api/practice/exam-plan') return jsonResponse(examPlanFixture)
    throw new Error('unexpected request: ' + path)
  }
  setActivePinia(createPinia())
})
afterEach(() => {
  globalThis.fetch = previousFetch
})

test('load 并发去重,加载成功后重复调用不再请求', async () => {
  const store = useExamPlanStore()
  const [first, second] = await Promise.all([store.load(), store.load()])
  assert.deepEqual(first, examPlanFixture)
  assert.deepEqual(second, examPlanFixture)
  assert.equal(calls.filter((path) => path === '/api/practice/exam-plan').length, 1)
  await store.load()
  assert.equal(calls.filter((path) => path === '/api/practice/exam-plan').length, 1)
  assert.equal(store.isLoaded, true)
})

test('exam plan supplies selected codes directly without options requests', async () => {
  const store = useExamPlanStore()
  const plan = await store.load()
  assert.equal(plan.majorCode, '120206')
  assert.deepEqual(plan.subjectCodes, ['GD-15043'])
  assert.deepEqual(calls, ['/api/practice/exam-plan'])
})

test('reset 作废旧读取，不允许旧账号计划写回缓存', async () => {
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  globalThis.fetch = async () => {
    await held
    return jsonResponse(examPlanFixture)
  }
  const store = useExamPlanStore()
  const pending = store.load()
  store.reset()
  release()
  assert.equal(await pending, null)
  assert.equal(store.plan, null)
  assert.equal(store.isLoaded, false)
})

test('save 返回的新计划作废在途读取，迟到响应不能覆盖保存结果', async () => {
  let release
  const held = new Promise((resolve) => {
    release = resolve
  })
  const updated = { ...examPlanFixture, major: { ...examPlanFixture.major, name: '新专业' } }
  globalThis.fetch = async (_url, options) => {
    if (options.method === 'PUT') return jsonResponse(updated)
    await held
    return jsonResponse(examPlanFixture)
  }
  const store = useExamPlanStore()
  const pending = store.load()
  await store.save({ provinceCode: '440000', majorCode: '120206', subjectCodes: ['GD-15043'] })
  release()
  assert.equal(await pending, null)
  assert.equal(store.plan.major.name, '新专业')
  assert.equal(store.isLoaded, true)
  assert.equal(store.isLoading, false)
})

test('load 失败保留错误并允许重试，成功后缓存空计划', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, message: '失败', data: null }), { status: 500 })
  const store = useExamPlanStore()
  assert.equal(await store.load(), null)
  assert.equal(store.isLoaded, false)
  assert.equal(store.error, '考试计划加载失败')
  globalThis.fetch = async () => jsonResponse(null)
  assert.equal(await store.load(), null)
  assert.equal(store.isLoaded, true)
  assert.equal(store.error, null)
})

test('save 失败不覆盖已经加载的计划', async () => {
  const store = useExamPlanStore()
  await store.load()
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, message: '冲突', data: null }), { status: 409 })
  await assert.rejects(
    store.save({ provinceCode: '440000', majorCode: '120206', subjectCodes: [] }),
  )
  assert.deepEqual(store.plan, examPlanFixture)
})

test('save 只提交报考省份、专业代码和所选科目代码', async () => {
  let body
  globalThis.fetch = async (url, options) => {
    assert.equal(String(url), '/api/practice/exam-plan')
    assert.equal(options.method, 'PUT')
    body = JSON.parse(options.body)
    return jsonResponse({ ...examPlanFixture, provinceCode: '110000' })
  }
  const store = useExamPlanStore()
  await store.save({ provinceCode: '110000', majorCode: '120206', subjectCodes: ['GD-15043'] })
  assert.deepEqual(body, {
    provinceCode: '110000',
    majorCode: '120206',
    subjectCodes: ['GD-15043'],
  })
  assert.equal(store.plan.provinceCode, '110000')
})
