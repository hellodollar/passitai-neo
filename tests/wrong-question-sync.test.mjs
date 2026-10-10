import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { loadSource } from './helpers/load-source.mjs'

const { useWrongQuestionSync } = await loadSource('composables/useWrongQuestionSync.ts')
const { useAuthStore } = await loadSource('stores/auth.ts')
const { usePracticeStore } = await loadSource('stores/practice.ts')
const { useToasts } = await loadSource('utils/toast.ts')

const DEFAULT_SETTINGS = {
  autoNext: false,
  recordWrongQuestions: true,
  showExplanationAfterAnswer: true,
  loopAfterCompletion: false,
  autoSubmitAfterCompletion: false,
  removeMistakeOnCorrect: false,
}

const SESSION = {
  token: 'token',
  user: {
    id: 'usr_one',
    email: 'user@example.com',
    role: 'user',
    createdAt: '2026-01-01T00:00:00Z',
  },
}

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

const previousFetch = globalThis.fetch
let requests
let resolveSettings

function envelope(data, { code = 0, status = 200 } = {}) {
  return new Response(
    JSON.stringify({ code, message: code === 0 ? 'success' : '资源不存在', data }),
    {
      status,
      headers: { 'content-type': 'application/json' },
    },
  )
}

/** 通过真实 API 模块与统一 HTTP 客户端发出请求，仅在 fetch 边界记录并应答。 */
function installFetch({
  settings = DEFAULT_SETTINGS,
  wrongQuestionStatus = 200,
  deferSettings = false,
} = {}) {
  requests = []
  resolveSettings = null
  globalThis.fetch = async (url, options = {}) => {
    const href = String(url)
    if (href.endsWith('/practice/settings')) {
      if (deferSettings) {
        return new Promise((resolve) => {
          resolveSettings = () => resolve(envelope(settings))
        })
      }
      return envelope(settings)
    }
    const method = (options.method ?? 'GET').toUpperCase()
    requests.push({ method, href, body: options.body ? JSON.parse(options.body) : undefined })
    if (wrongQuestionStatus !== 200) return envelope(null, { status: wrongQuestionStatus })
    return envelope(null)
  }
}

function question(overrides = {}) {
  return {
    id: 'qst_one',
    subjectId: 'sub_one',
    title: '题目',
    questionType: 'single',
    A: '甲',
    B: '乙',
    C: null,
    D: null,
    E: null,
    F: null,
    correctAnswer: 'A',
    explanation: null,
    ...overrides,
  }
}

function answer(questionId, values, text = '') {
  return { questionId, text, values }
}

function setup({
  session = SESSION,
  context = () => ({ questionId: 'qst_one', subjectId: 'sub_one', paperId: 'pap_one' }),
  ...fetchOptions
} = {}) {
  installFetch(fetchOptions)
  const auth = useAuthStore()
  if (session) auth.session = session
  const settingsStore = usePracticeStore()
  const sync = useWrongQuestionSync({ context })
  return { auth, settingsStore, sync }
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { localStorage: new MemoryStorage() })
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  setActivePinia(createPinia())
})

afterEach(() => {
  globalThis.fetch = previousFetch
  useToasts().value = []
})

test('无参考答案的选择题既不收录也不移除', async () => {
  const { sync } = setup()
  await sync.syncOnAnswered(question({ correctAnswer: '' }), answer('qst_one', ['B']))
  assert.equal(requests.length, 0)
})

test('有关闭记录时答错不写入错题', async () => {
  const { sync } = setup({ settings: { ...DEFAULT_SETTINGS, recordWrongQuestions: false } })
  await sync.syncOnAnswered(question(), answer('qst_one', ['B']))
  assert.equal(requests.length, 0)
})

test('答错按题目上下文收录错题', async () => {
  const { sync } = setup()
  await sync.syncOnAnswered(question(), answer('qst_one', ['B']))
  assert.deepEqual(requests, [
    {
      method: 'POST',
      href: '/api/wrong-questions',
      body: { questionId: 'qst_one', subjectId: 'sub_one', paperId: 'pap_one' },
    },
  ])
})

test('答对开启自动移除时按上下文移除错题', async () => {
  const { sync } = setup({ settings: { ...DEFAULT_SETTINGS, removeMistakeOnCorrect: true } })
  await sync.syncOnAnswered(question(), answer('qst_one', ['A']))
  assert.deepEqual(requests, [
    {
      method: 'DELETE',
      href: '/api/wrong-questions',
      body: { questionId: 'qst_one', subjectId: 'sub_one', paperId: 'pap_one' },
    },
  ])
})

test('答对但未开启自动移除时不请求移除', async () => {
  const { sync } = setup({ settings: { ...DEFAULT_SETTINGS, removeMistakeOnCorrect: false } })
  await sync.syncOnAnswered(question(), answer('qst_one', ['A']))
  assert.equal(requests.length, 0)
})

test('非选择题与缺少上下文的题目不触发同步', async () => {
  const { sync } = setup({ context: () => null })
  await sync.syncOnAnswered(question({ questionType: 'essay' }), answer('qst_one', [], '作答'))
  await sync.syncOnAnswered(question(), answer('qst_one', ['B']))
  assert.equal(requests.length, 0)
})

test('等待设置期间账号切换后不再同步', async () => {
  const { auth, sync } = setup({ deferSettings: true })
  const pending = sync.syncOnAnswered(question(), answer('qst_one', ['B']))
  await Promise.resolve()
  await Promise.resolve()
  assert.ok(resolveSettings, '设置请求应已发出')
  auth.session = { ...SESSION, user: { ...SESSION.user, id: 'usr_two' } }
  resolveSettings()
  await pending
  assert.equal(requests.length, 0)
})

test('上下文按题隔离，各自携带真实题集与科目', async () => {
  const contexts = {
    qst_a: { questionId: 'qst_a', subjectId: 'sub_a', paperId: 'pap_a' },
    qst_b: { questionId: 'qst_b', subjectId: 'sub_b', paperId: 'pap_b' },
  }
  const { sync } = setup({ context: (id) => contexts[id] ?? null })
  await sync.syncOnAnswered(question({ id: 'qst_a', subjectId: 'sub_a' }), answer('qst_a', ['B']))
  await sync.syncOnAnswered(question({ id: 'qst_b', subjectId: 'sub_b' }), answer('qst_b', ['B']))
  assert.deepEqual(
    requests.map((request) => request.body),
    [
      { questionId: 'qst_a', subjectId: 'sub_a', paperId: 'pap_a' },
      { questionId: 'qst_b', subjectId: 'sub_b', paperId: 'pap_b' },
    ],
  )
})

test('同步失败只提示一次，后续不再重复打扰', async () => {
  const { sync } = setup({ wrongQuestionStatus: 500 })
  await sync.syncOnAnswered(question(), answer('qst_one', ['B']))
  await sync.syncOnAnswered(question(), answer('qst_one', ['B']))
  assert.equal(requests.length, 2)
  const toasts = useToasts().value
  assert.equal(toasts.length, 1)
  assert.match(toasts[0].message, /错题记录失败/)
})
