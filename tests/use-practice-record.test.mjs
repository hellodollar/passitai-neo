import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { createRenderer, h, nextTick, ref } from 'vue'

import { loadSource } from './helpers/load-source.mjs'

const { usePracticeRecord } = await loadSource('composables/usePracticeRecord.ts')
const {
  clearPracticeRecords,
  createPracticeRecord,
  readPracticeRecord,
  updatePracticeRecord,
  writePracticeRecord,
} = await loadSource('utils/practice/record.ts')
const { markPracticeRecordsCleared } = await loadSource('utils/practice/record-control.ts')

class MemoryStorage {
  items = new Map()
  writes = []
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
    this.writes.push({ key, value: String(value) })
  }
  removeItem(key) {
    this.items.delete(key)
  }
}

class StorageEventPolyfill extends Event {
  constructor(type, init = {}) {
    super(type)
    this.key = init.key ?? null
    this.oldValue = init.oldValue ?? null
    this.newValue = init.newValue ?? null
    this.url = init.url ?? ''
    this.storageArea = init.storageArea ?? null
  }
}

const context = {
  userId: 'usrone',
  paperId: 'papone',
  source: 'practice',
  subjectId: 'subone',
  paperType: 'pastExams',
}
const questions = [
  { id: 'que_one', questionType: 'single', title: '' },
  { id: 'que_two', questionType: 'single', title: '' },
]
const fingerprints = { que_one: 'fp1', que_two: 'fp2' }
const answer = {
  questionId: 'que_one',
  fingerprint: 'fp1',
  text: '甲',
  values: ['A'],
}
const input = {
  questionId: 'que_two',
  fingerprint: 'fp2',
  text: '未确认',
  values: [],
}
const recordKey = (identity = context) =>
  `passitai:practice-record:v3:${encodeURIComponent(identity.userId)}:${identity.source}:${encodeURIComponent(identity.paperId)}`
const storedRecord = () => {
  const raw = window.localStorage.getItem(recordKey())
  return raw ? JSON.parse(raw) : null
}
const recordWrites = () =>
  window.localStorage.writes
    .filter(({ key }) => key === recordKey())
    .map(({ value }) => JSON.parse(value))
const makeRecord = (startedAt = Date.now() - 1000) =>
  updatePracticeRecord(createPracticeRecord(context, startedAt), {
    startedAt,
    currentQuestionId: 'que_two',
    answers: { que_one: answer },
    inputs: { que_two: input },
    pendingSubmissionId: '',
    submissionAnswers: { que_one: 'A' },
  })
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const host = {
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  setText: () => {},
  setElementText: () => {},
  insert: () => {},
  remove: () => {},
  parentNode: () => null,
  nextSibling: () => null,
  patchProp: () => {},
}
const renderer = createRenderer(host)

function setupDependencies() {
  const userId = ref('usrone')
  const questionsRef = ref([...questions])
  const clearedCalls = []
  const holder = { api: null }
  const onCleared = () => {
    clearedCalls.push({
      answers: Object.keys(holder.api?.answers.value ?? {}).length,
      inputs: Object.keys(holder.api?.inputs.value ?? {}).length,
      currentIndex: holder.api?.currentIndex.value,
      pendingSubmissionId: holder.api?.pendingSubmissionId.value,
    })
  }
  return {
    options: {
      userId: () => userId.value,
      questions: questionsRef,
      onCleared,
    },
    userId,
    questions: questionsRef,
    holder,
    cleared: () => clearedCalls.length,
    clearedCalls,
  }
}

function mount(state) {
  let api
  const root = {}
  renderer.render(
    h({
      setup() {
        api = usePracticeRecord(state.options)
        return () => null
      },
    }),
    root,
  )
  state.holder.api = api
  return {
    api,
    unmount: () => renderer.render(null, root),
  }
}

const previousWindow = globalThis.window
const previousDocument = globalThis.document
const previousStorageEvent = globalThis.StorageEvent
beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: new MemoryStorage(),
    setTimeout: (...args) => globalThis.setTimeout(...args),
    clearTimeout: (...args) => globalThis.clearTimeout(...args),
  })
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  globalThis.StorageEvent = StorageEventPolyfill
})
afterEach(() => {
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
  if (previousStorageEvent === undefined) delete globalThis.StorageEvent
  else globalThis.StorageEvent = previousStorageEvent
})

test('加载题集恢复已确认答案、草稿、位置和开始时间，就绪后允许保存', async () => {
  const saved = makeRecord()
  writePracticeRecord(saved)
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  const restored = api.loadSavedRecord(context, fingerprints)

  assert.equal(restored, true)
  assert.equal(api.localRecord.value.answers.que_one.text, '甲')
  assert.equal(api.answers.value.que_one.text, '甲')
  assert.equal(api.inputs.value.que_two.text, '未确认')
  assert.equal(api.currentIndex.value, 1)
  assert.equal(api.fingerprints.value.que_one, 'fp1')
  assert.equal(api.startedAt.value, saved.startedAt)
  assert.equal(api.pendingSubmissionId.value, '')
  assert.equal(api.recordReady.value, false)

  api.markRecordReady()
  assert.equal(api.recordReady.value, true)
  unmount()
})

test('没有保存记录时返回 false 并重置为空白首题', async () => {
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  api.answers.value = { que_one: answer }
  api.inputs.value = { que_two: input }
  api.currentIndex.value = 1

  const restored = api.loadSavedRecord(context, fingerprints)

  assert.equal(restored, false)
  assert.deepEqual(api.answers.value, {})
  assert.deepEqual(api.inputs.value, {})
  assert.equal(api.currentIndex.value, 0)
  assert.equal(api.fingerprints.value.que_two, 'fp2')
  assert.ok(api.localRecord.value)
  unmount()
})

test('保存防抖、pagehide/隐藏立即保存，卸载后监听与订阅停止', async () => {
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  api.scheduleRecordSave()
  await delay(50)
  assert.equal(storedRecord(), null)

  api.loadSavedRecord(context, fingerprints)
  api.markRecordReady()
  api.scheduleRecordSave()
  assert.equal(storedRecord(), null)
  await delay(50)
  assert.equal(storedRecord(), null)
  await delay(300)
  assert.equal(storedRecord(), null)

  api.answers.value = { que_one: answer }
  api.scheduleRecordSave()
  await delay(300)
  assert.equal(storedRecord().answers.que_one.text, '甲')

  api.inputs.value = { que_two: { ...input, text: '页面隐藏前' } }
  window.dispatchEvent(new Event('pagehide'))
  assert.equal(storedRecord().inputs.que_two.text, '页面隐藏前')

  api.inputs.value = { que_two: { ...input, text: '隐藏时保存' } }
  document.visibilityState = 'hidden'
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(storedRecord().inputs.que_two.text, '隐藏时保存')

  api.answers.value = { que_one: { ...answer, text: '卸载时保存' } }
  unmount()
  assert.equal(storedRecord().answers.que_one.text, '卸载时保存')

  api.answers.value = { que_one: { ...answer, text: '卸载后泄漏' } }
  window.dispatchEvent(new Event('pagehide'))
  assert.equal(storedRecord().answers.que_one.text, '卸载时保存')

  const clearedBefore = state.cleared()
  clearPracticeRecords({ kind: 'paper', identity: context })
  assert.equal(state.cleared(), clearedBefore)
})

test('连续两次防抖保存只写入最终输入', async () => {
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  api.loadSavedRecord(context, fingerprints)
  api.markRecordReady()

  api.inputs.value = { que_two: { ...input, text: '第一次输入' } }
  api.scheduleRecordSave()
  await delay(100)
  api.inputs.value = { que_two: { ...input, text: '第二次输入' } }
  api.scheduleRecordSave()
  await delay(300)

  const writes = recordWrites()
  assert.equal(writes.length, 1)
  assert.equal(writes[0].inputs.que_two.text, '第二次输入')
  assert.equal(storedRecord().inputs.que_two.text, '第二次输入')
  unmount()
})

test('卸载前有防抖待保存时立即写入且后续定时器不再回写', async () => {
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  api.loadSavedRecord(context, fingerprints)
  api.markRecordReady()

  api.inputs.value = { que_two: { ...input, text: '卸载前输入' } }
  api.scheduleRecordSave()
  unmount()

  assert.equal(storedRecord().inputs.que_two.text, '卸载前输入')
  const writesAfterUnmount = recordWrites().length

  api.inputs.value = { que_two: { ...input, text: '卸载后输入' } }
  await delay(300)
  assert.equal(storedRecord().inputs.que_two.text, '卸载前输入')
  assert.equal(recordWrites().length, writesAfterUnmount)
})

test('账号切换后拒绝把旧账号记录回写到新账号或旧记录键', async () => {
  const saved = makeRecord()
  writePracticeRecord(saved)
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  api.loadSavedRecord(context, fingerprints)
  api.markRecordReady()

  state.userId.value = 'usrtwo'
  api.answers.value = { que_one: { ...answer, text: '不应写入' } }
  api.inputs.value = { que_two: input }
  api.saveRecordNow()
  api.scheduleRecordSave()
  await delay(300)

  assert.equal(storedRecord().answers.que_one.text, '甲')
  assert.equal(storedRecord().inputs.que_two.text, '未确认')
  assert.equal(
    window.localStorage.getItem('passitai:practice-record:v3:usrtwo:practice:papone'),
    null,
  )
  unmount()
})

test('清理通知使当前记录失效，先重置自身状态再通知页面，旧答案不回写', async () => {
  const saved = makeRecord()
  writePracticeRecord(saved)
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  assert.equal(api.loadSavedRecord(context, fingerprints), true)
  api.markRecordReady()

  clearPracticeRecords({ kind: 'paper', identity: context })

  assert.equal(state.cleared(), 1)
  assert.deepEqual(state.clearedCalls[0], {
    answers: 0,
    inputs: 0,
    currentIndex: 0,
    pendingSubmissionId: '',
  })
  assert.deepEqual(api.answers.value, {})
  assert.deepEqual(api.inputs.value, {})
  assert.equal(api.currentIndex.value, 0)
  assert.equal(api.pendingSubmissionId.value, '')
  assert.deepEqual(api.localRecord.value.answers, {})
  assert.notEqual(api.localRecord.value.clearToken, saved.clearToken)
  assert.equal(readPracticeRecord(context), null)

  api.saveRecordNow()
  assert.equal(readPracticeRecord(context), null)

  api.answers.value = { que_one: { ...answer, text: '清理后新答案' } }
  api.saveRecordNow()
  const current = readPracticeRecord(context)
  assert.ok(current)
  assert.equal(current.answers.que_one.text, '清理后新答案')
  assert.equal(current.answers.que_one.fingerprint, 'fp1')
  unmount()
})

test('模拟 storage 通知触发跨标签清理并失效旧记录', async () => {
  const saved = makeRecord()
  writePracticeRecord(saved)
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  assert.equal(api.loadSavedRecord(context, fingerprints), true)
  api.markRecordReady()

  markPracticeRecordsCleared({ kind: 'paper', identity: context })
  const clearKey = [...window.localStorage.items.keys()].find((key) =>
    key.startsWith('passitai:practice-record-clear:'),
  )
  assert.ok(clearKey)
  window.dispatchEvent(new StorageEvent('storage', { key: clearKey }))
  await nextTick()

  assert.equal(state.cleared(), 1)
  assert.deepEqual(state.clearedCalls[0], {
    answers: 0,
    inputs: 0,
    currentIndex: 0,
    pendingSubmissionId: '',
  })
  assert.deepEqual(api.answers.value, {})
  assert.deepEqual(api.inputs.value, {})
  assert.equal(api.currentIndex.value, 0)
  assert.equal(readPracticeRecord(context), null)
  unmount()
})

test('保存前发现记录代际失效时先清理页面状态，不把旧内存记录复活', async () => {
  const saved = makeRecord()
  writePracticeRecord(saved)
  const state = setupDependencies()
  const { api, unmount } = mount(state)
  await nextTick()

  api.loadSavedRecord(context, fingerprints)
  api.markRecordReady()
  api.answers.value = { que_one: answer }
  api.inputs.value = { que_two: input }

  markPracticeRecordsCleared({ kind: 'paper', identity: context })
  api.saveRecordNow()

  assert.equal(state.cleared(), 1)
  assert.equal(api.answers.value.que_one, undefined)
  assert.equal(api.inputs.value.que_two, undefined)
  assert.deepEqual(api.localRecord.value.answers, {})
  assert.equal(readPracticeRecord(context), null)
  assert.equal(writePracticeRecord(saved), false)
  unmount()
})
