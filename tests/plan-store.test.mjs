import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { createPinia, setActivePinia } from 'pinia'
import { loadSource } from './helpers/load-source.mjs'

const { usePlanStore } = await loadSource('stores/plan.ts')

const previousFetch = globalThis.fetch
const planFixture = {
  majorName: '汉语言文学',
  majorCode: 'maj-c',
  subjects: [{ code: 'sub-1', name: '科目一' }],
}
const entriesFixture = [{ type: 'baseline', name: '基础练习', children: [] }]

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
    if (path === '/api/plan') return jsonResponse(planFixture)
    throw new Error('unexpected request: ' + path)
  }
  setActivePinia(createPinia())
})
afterEach(() => {
  globalThis.fetch = previousFetch
})

test('ensurePlan 并发去重,加载成功后重复调用不再请求', async () => {
  const store = usePlanStore()
  const [first, second] = await Promise.all([store.ensurePlan(), store.ensurePlan()])
  assert.deepEqual(first, planFixture)
  assert.deepEqual(second, planFixture)
  assert.equal(calls.filter((path) => path === '/api/plan').length, 1)
  await store.ensurePlan()
  assert.equal(calls.filter((path) => path === '/api/plan').length, 1)
  assert.equal(store.planLoaded, true)
})

test('ensureSubjectIdMap 按专业缓存,重复解析只走一次 majors+subjects', async () => {
  const store = usePlanStore()
  const map1 = await store.ensureSubjectIdMap('maj-c')
  const map2 = await store.ensureSubjectIdMap('maj-c')
  assert.equal(map1.get('sub-1'), 'sub-id-1')
  assert.equal(map2.get('sub-1'), 'sub-id-1')
  assert.equal(calls.filter((path) => path === '/api/options/majors').length, 1)
  assert.equal(calls.filter((path) => path === '/api/options/subjects').length, 1)
})

test('ensureEntries 并发去重,命中缓存不再请求', async () => {
  const store = usePlanStore()
  const [first, second] = await Promise.all([
    store.ensureEntries('sub-id-1'),
    store.ensureEntries('sub-id-1'),
  ])
  assert.deepEqual(first, entriesFixture)
  assert.deepEqual(second, entriesFixture)
  assert.equal(calls.filter((path) => path === '/api/practice/entries').length, 1)
  await store.ensureEntries('sub-id-1')
  assert.equal(calls.filter((path) => path === '/api/practice/entries').length, 1)
})

test('clear 清空缓存后重新拉取,且迟到的旧响应不能写入新会话', async () => {
  let releaseStale
  const staleHeld = new Promise((resolve) => {
    releaseStale = resolve
  })
  globalThis.fetch = async (url) => {
    const path = String(url).split('?')[0]
    if (path === '/api/practice/entries') {
      await staleHeld
      return jsonResponse(entriesFixture)
    }
    if (path === '/api/plan') return jsonResponse(planFixture)
    throw new Error('unexpected request: ' + path)
  }
  const store = usePlanStore()
  await store.ensurePlan()
  const staleEntries = store.ensureEntries('sub-id-1')

  store.clear()
  assert.equal(store.planLoaded, false)
  assert.equal(store.entriesBySubjectId.size, 0)

  releaseStale()
  assert.equal(await staleEntries, null)
  assert.equal(store.entriesBySubjectId.size, 0)

  // 清空后的新请求正常发起并写入新缓存
  const reloaded = await store.ensureEntries('sub-id-1')
  assert.deepEqual(reloaded, entriesFixture)
  assert.deepEqual(store.entriesBySubjectId.get('sub-id-1'), entriesFixture)
})

test('applyPlan 作废在途刷新,迟到的旧计划不能覆盖弹框保存的新计划', async () => {
  let releaseRefresh
  const refreshHeld = new Promise((resolve) => {
    releaseRefresh = resolve
  })
  globalThis.fetch = async (url) => {
    const path = String(url).split('?')[0]
    if (path === '/api/plan') {
      await refreshHeld
      return jsonResponse(planFixture)
    }
    throw new Error('unexpected request: ' + path)
  }
  const store = usePlanStore()
  const pendingRefresh = store.ensurePlan()

  const updated = { ...planFixture, majorName: '新专业' }
  store.applyPlan(updated)
  releaseRefresh()

  assert.equal(await pendingRefresh, null)
  assert.equal(store.plan.majorName, '新专业')
  assert.equal(store.planLoaded, true)
  assert.equal(store.planFetching, false)
})

test('计划加载失败标记 failed 且不标记 loaded,下次进入自动重试', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ ok: false, message: '失败', data: null }), { status: 500 })
  const store = usePlanStore()
  assert.equal(await store.ensurePlan(), null)
  assert.equal(store.planLoaded, false)
  assert.equal(store.planFailed, true)
  assert.equal(store.plan, null)

  globalThis.fetch = async () => jsonResponse(planFixture)
  assert.deepEqual(await store.ensurePlan(), planFixture)
  assert.equal(store.planLoaded, true)
  assert.equal(store.planFailed, false)
})
