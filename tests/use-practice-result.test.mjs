import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'
import { effectScope, nextTick, ref } from 'vue'

import { loadSource } from './helpers/load-source.mjs'

const { usePracticeResult } = await loadSource('composables/usePracticeResult.ts')
const { useAuthStore } = await loadSource('stores/auth.ts')
const { STORAGE_KEYS } = await loadSource('constants/app.ts')
const originalWindow = globalThis.window
const originalFetch = globalThis.fetch
let pinia
let scopes
let calls
let handler

const response = (data, status = 200) =>
  new Response(
    JSON.stringify({ ok: status === 200, data, message: status === 200 ? undefined : '加载失败' }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  )
const flush = () => new Promise((resolve) => setTimeout(resolve, 0))
const deferred = () => {
  let resolve
  const promise = new Promise((done) => {
    resolve = done
  })
  return { promise, resolve }
}
const paper = (id) => ({
  id,
  subjectCode: 'GD-15043',
  provinceCode: '440000',
  name: '隔离测试题集',
  type: 'pointCoverage',
  paperLayout: 'exam',
  contentPeriod: '2026-04',
  sourceType: 'system',
  questionCount: 2,
  sections: [
    {
      name: '单选',
      questionType: 'single',
      perScore: 50,
      questionIds: ['qstfixture'],
      items: [
        {
          id: 'qstfixture',
          subjectCode: 'GD-15043',
          title: '测试题目',
          type: 'single',
          A: '甲',
          B: '乙',
          C: null,
          D: null,
          E: null,
          F: null,
          correctAnswer: 'A',
          explanation: '测试解析',
        },
      ],
    },
    {
      name: '简答',
      questionType: 'shortAnswer',
      perScore: 50,
      questionIds: ['qstsubj'],
      items: [
        {
          id: 'qstsubj',
          subjectCode: 'GD-15043',
          title: '简答测试',
          type: 'shortAnswer',
          A: null,
          B: null,
          C: null,
          D: null,
          E: null,
          F: null,
          correctAnswer: '参考要点',
          explanation: '简答解析',
        },
      ],
    },
  ],
})
const submission = (id, answer = 'A', overrides = {}) => ({
  id,
  subjectCode: 'GD-15043',
  paperId: 'papfixture',
  paperName: '隔离测试题集',
  userAnswers: { qstfixture: answer, qstsubj: '我的作答' },
  totalQuestions: 2,
  answeredCount: 2,
  objectiveTotal: 1,
  objectiveCorrect: answer === 'A' ? 1 : 0,
  objectiveScore: answer === 'A' ? 50 : 0,
  subjectiveScore: null,
  score: null,
  durationSeconds: 36,
  createdAt: '2026-11-24T10:00:00Z',
  ...overrides,
})

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
  const auth = useAuthStore()
  auth.session = session
  return auth
}

function setup({ paperId = 'papfixture', submissionId = 'recfirst' } = {}) {
  const targetPaper = ref(paperId)
  const targetSubmission = ref(submissionId)
  const scope = effectScope()
  scopes.push(scope)
  const model = scope.run(() =>
    usePracticeResult({
      paperId: () => targetPaper.value,
      submissionId: () => targetSubmission.value,
      subjectName: () => '测试科目',
    }),
  )
  return { model, scope, targetPaper, targetSubmission }
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
  scopes = []
  calls = []
  handler = (url) =>
    response(
      url.includes('/submissions/') ? submission(url.split('/').at(-1)) : paper('papfixture'),
    )
  globalThis.fetch = async (input, options) => {
    const url = String(input)
    const token = new Headers(options?.headers).get('Authorization')
    const method = options?.method ?? 'GET'
    const body = options?.body ? JSON.parse(String(options.body)) : undefined
    calls.push({ url, token, method, body })
    return handler(url, token, method, body)
  }
  signIn()
})

afterEach(() => {
  scopes.forEach((scope) => scope.stop())
  for (const store of pinia._s.values()) store.$dispose()
  globalThis.window = originalWindow
  globalThis.fetch = originalFetch
})

test('报告加载成功使用当前提交与题集，切换目标立即清除旧报告且只接纳最新响应', async () => {
  const { model, targetSubmission } = setup()
  await flush()
  assert.equal(model.result.value.submissionId, 'recfirst')
  assert.equal(model.result.value.correctCount, 1)
  assert.equal(model.result.value.subjectName, '测试科目')

  const old = deferred()
  handler = (url) =>
    url.endsWith('/recsecond')
      ? old.promise
      : response(
          url.includes('/submissions/') ? submission(url.split('/').at(-1)) : paper('papfixture'),
        )
  targetSubmission.value = 'recsecond'
  await nextTick()
  assert.equal(model.result.value, null)
  assert.equal(model.loading.value, true)
  targetSubmission.value = 'recthird'
  await nextTick()
  await flush()
  assert.equal(model.result.value.submissionId, 'recthird')
  old.resolve(response(submission('recsecond')))
  await flush()
  assert.equal(model.result.value.submissionId, 'recthird')
  assert.equal(model.loadError.value, false)
})

test('更换账号重新加载报告，旧账号的迟到响应不能覆盖新账号', async () => {
  const old = deferred()
  handler = (url, token) => {
    if (!url.includes('/submissions/')) return response(paper('papfixture'))
    return token === 'Bearer fixture-first' ? old.promise : response(submission('recfirst', 'B'))
  }
  const { model } = setup()
  await nextTick()
  signIn('second')
  await nextTick()
  assert.equal(model.result.value, null)
  await flush()
  assert.equal(model.result.value.questions[0].userAnswer, 'B')
  assert.equal(model.result.value.wrongCount, 1)
  old.resolve(response(submission('recfirst', 'A')))
  await flush()
  assert.equal(model.result.value.questions[0].userAnswer, 'B')
  assert.equal(model.loadError.value, false)
  assert.ok(calls.some((call) => call.token === 'Bearer fixture-second'))
})

test('离页后旧请求不更新状态，手动重试也不能发出新请求', async () => {
  const pending = deferred()
  handler = (url) =>
    url.includes('/submissions/') ? pending.promise : response(paper('papfixture'))
  const { model, scope } = setup()
  scope.stop()
  const before = calls.length
  pending.resolve(response(submission('recfirst')))
  await flush()
  await model.loadResult()
  assert.equal(model.result.value, null)
  assert.equal(model.loadError.value, false)
  assert.equal(calls.length, before)
})

test('失败提供重试状态，缺失路由参数与退出登录不发报告请求', async () => {
  handler = () => response(null, 400)
  const { model } = setup()
  await flush()
  assert.equal(model.loadError.value, true)
  handler = (url) =>
    response(url.includes('/submissions/') ? submission('recfirst') : paper('papfixture'))
  await model.loadResult()
  assert.equal(model.loadError.value, false)
  assert.ok(model.result.value)

  const before = calls.length
  const invalid = setup({ paperId: '' })
  assert.equal(invalid.model.loadError.value, true)
  assert.equal(calls.length, before)
  window.localStorage.removeItem(STORAGE_KEYS.authSession)
  useAuthStore().session = null
  await nextTick()
  assert.equal(model.result.value, null)
  assert.equal(calls.length, before)
})

test('主观题三档自评调用 PUT 接口并刷新得分，账号切换后忽略迟到自评响应', async () => {
  const { model } = setup()
  await flush()
  assert.equal(model.result.value.score, null)
  assert.equal(model.result.value.objectiveScore, 50)

  handler = (url, _token, method, body) => {
    assert.equal(method, 'PUT')
    assert.ok(
      url.endsWith('/api/practice/papers/papfixture/submissions/recfirst/subjective-self-grade'),
    )
    assert.deepEqual(body, { ratings: { qstsubj: 'mastered' } })
    return response(submission('recfirst', 'A', { subjectiveScore: 50, score: 100 }))
  }
  const ok = await model.submitSelfGrade({ qstsubj: 'mastered' })
  assert.equal(ok, true)
  assert.equal(model.result.value.subjectiveScore, 50)
  assert.equal(model.result.value.score, 100)

  const pendingGrade = deferred()
  handler = (url, _token, method) => {
    if (method === 'PUT') return pendingGrade.promise
    return response(
      url.includes('/submissions/') ? submission('recfirst', 'B') : paper('papfixture'),
    )
  }
  const stalePromise = model.submitSelfGrade({ qstsubj: 'missed' })
  signIn('second')
  await nextTick()
  await flush()
  pendingGrade.resolve(response(submission('recfirst', 'A', { subjectiveScore: 0, score: 50 })))
  assert.equal(await stalePromise, false)
  assert.equal(model.result.value.questions[0].userAnswer, 'B')
})
