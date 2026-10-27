import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const {
  clearPracticeRecords,
  clearUserPracticeRecords,
  createPracticeRecord,
  readPracticeRecord,
  restorePracticeRecord,
  updatePracticeRecord,
  writePracticeRecord,
} = await loadSource('utils/practice/record.ts')

class MemoryStorage {
  items = new Map()
  failWrites = false
  failRemovals = false
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
    if (this.failWrites) throw new Error('Quota exceeded')
    this.items.set(key, String(value))
  }
  removeItem(key) {
    if (this.failRemovals) throw new Error('Storage unavailable')
    this.items.delete(key)
  }
}

const now = Date.now() - 1000
const context = {
  userId: 'usrone',
  paperId: 'papone',
  source: 'practice',
  subjectId: 'subone',
  paperType: 'pastExam',
}
const answer = {
  questionId: 'que_one',
  fingerprint: 'fingerprint1',
  text: 'A',
  values: ['A'],
}
const input = {
  questionId: 'que_two',
  fingerprint: 'fingerprint2',
  text: '未确认文本',
  values: [],
}
const submissionId = 'rec123456abcdef'
const legacyKey = (record = context) =>
  `passitai:practice-draft:v1:${record.userId}:${record.paperId}`
const recordKey = (record = context) =>
  `passitai:practice-record:v3:${encodeURIComponent(record.userId)}:${record.source}:${encodeURIComponent(record.paperId)}`
const legacyDraft = (overrides = {}) => ({
  version: 1,
  userId: context.userId,
  paperId: context.paperId,
  startedAt: now,
  currentQuestionId: input.questionId,
  answers: { [answer.questionId]: answer },
  inputs: { [input.questionId]: input },
  pendingSubmissionId: submissionId,
  savedAt: now,
  ...overrides,
})
const progress = (overrides = {}) => ({
  startedAt: now,
  currentQuestionId: answer.questionId,
  answers: { [answer.questionId]: answer },
  inputs: {},
  pendingSubmissionId: '',
  submissionAnswers: { [answer.questionId]: 'A' },
  ...overrides,
})

let storage
const previousWindow = globalThis.window
beforeEach(() => {
  storage = new MemoryStorage()
  globalThis.window = { localStorage: storage }
})
afterEach(() => {
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
})

test('当前版本完整保存答案、未确认输入、位置及提交快照，刷新后直接恢复', () => {
  const record = updatePracticeRecord(
    createPracticeRecord(context, now),
    progress({
      currentQuestionId: input.questionId,
      inputs: { [input.questionId]: input },
      pendingSubmissionId: submissionId,
    }),
  )
  assert.equal(record.version, 3)
  assert.equal(writePracticeRecord(record), true)
  assert.deepEqual(readPracticeRecord(context), record)
  assert.deepEqual(record.pendingSubmission.payload, {
    submissionId,
    userAnswers: { [answer.questionId]: 'A' },
    startTime: new Date(now).toISOString(),
  })
})

test('v1 草稿和 v2 记录不会被读取、迁移或删除', () => {
  const oldDraft = JSON.stringify(legacyDraft())
  const oldRecordKey = recordKey().replace(':v3:', ':v2:')
  const oldRecord = JSON.stringify({ ...createPracticeRecord(context, now), version: 2 })
  storage.setItem(legacyKey(), oldDraft)
  storage.setItem(oldRecordKey, oldRecord)
  assert.equal(readPracticeRecord(context), null)
  assert.equal(storage.getItem(recordKey()), null)
  assert.equal(storage.getItem(legacyKey()), oldDraft)
  assert.equal(storage.getItem(oldRecordKey), oldRecord)
})

test('当前键中的错误版本、缺失清理代际或身份不符的记录不能恢复', () => {
  const valid = createPracticeRecord(context, now)
  for (const invalid of [
    { ...valid, version: 2 },
    { ...valid, clearToken: undefined },
    { ...valid, userId: 'usrother' },
  ]) {
    storage.setItem(recordKey(), JSON.stringify(invalid))
    assert.equal(readPracticeRecord(context), null)
  }
})

test('当前记录损坏时不回退读取旧草稿', () => {
  storage.setItem(recordKey(), '{invalid')
  storage.setItem(legacyKey(), JSON.stringify(legacyDraft()))
  assert.equal(readPracticeRecord(context), null)
  assert.equal(storage.getItem(recordKey()), '{invalid')
})

test('新记录按用户、题集和练习来源隔离，包括相同集合标识', () => {
  const identities = [
    { ...context, source: 'favorites', paperId: 'collection:subject:subone', paperType: null },
    { ...context, source: 'mistakes', paperId: 'collection:subject:subone', paperType: null },
    { ...context, source: 'favorites', paperId: 'collection:paper:papone', paperType: null },
    {
      ...context,
      userId: 'usrother',
      source: 'favorites',
      paperId: 'collection:subject:subone',
      paperType: null,
    },
  ]
  for (const [index, identity] of identities.entries()) {
    const record = createPracticeRecord(identity, now)
    record.currentQuestionId = `que_${index}`
    assert.equal(writePracticeRecord(record), true)
  }
  assert.equal(storage.length, 4)
  identities.forEach((identity, index) =>
    assert.equal(readPracticeRecord(identity).currentQuestionId, `que_${index}`),
  )
  clearPracticeRecords({ kind: 'paper', identity: identities[0] })
  assert.equal(readPracticeRecord(identities[0]), null)
  assert.ok(readPracticeRecord(identities[1]))
})

test('只在确认答案变化时递增版本，切题和未确认输入不改变版本', () => {
  const initial = createPracticeRecord(context, now)
  const first = updatePracticeRecord(initial, progress())
  assert.equal(first.answerRevision, 1)
  const edited = updatePracticeRecord(
    first,
    progress({
      inputs: { [input.questionId]: input },
      currentQuestionId: input.questionId,
    }),
  )
  assert.equal(edited.answerRevision, 1)
  assert.deepEqual(initial.answers, {})
  const changed = updatePracticeRecord(
    edited,
    progress({
      answers: { [answer.questionId]: { ...answer, values: ['B'], text: 'B' } },
    }),
  )
  assert.equal(changed.answerRevision, 2)
})

test('待提交请求快照独立于输入对象，并在同一次提交的保存中保持固定', () => {
  const first = updatePracticeRecord(createPracticeRecord(context, now), progress())
  const submittedAnswers = { [answer.questionId]: ['A'] }
  const pending = updatePracticeRecord(
    first,
    progress({
      pendingSubmissionId: submissionId,
      submissionAnswers: submittedAnswers,
    }),
  )
  submittedAnswers[answer.questionId].push('B')
  assert.deepEqual(pending.pendingSubmission.payload.userAnswers, { [answer.questionId]: ['A'] })
  const saved = updatePracticeRecord(
    pending,
    progress({
      pendingSubmissionId: submissionId,
      submissionAnswers: { [answer.questionId]: 'B' },
    }),
  )
  assert.deepEqual(saved.pendingSubmission, pending.pendingSubmission)
  const changed = updatePracticeRecord(
    pending,
    progress({
      pendingSubmissionId: submissionId,
      answers: { [answer.questionId]: { ...answer, values: ['B'], text: 'B' } },
    }),
  )
  assert.equal(changed.pendingSubmission, null)
})

test('缺少固定快照的待提交信息被丢弃，已确认答案仍可恢复', () => {
  const record = updatePracticeRecord(createPracticeRecord(context, now), progress())
  record.pendingSubmission = {
    submissionId,
    answerRevision: record.answerRevision,
    payload: null,
  }
  writePracticeRecord(record)
  const restored = readPracticeRecord(context)
  assert.deepEqual(restored.answers, record.answers)
  assert.equal(restored.pendingSubmission, null)
})

test('按题目恢复、页面保存、刷新读取的完整链路保留作答', () => {
  const initial = updatePracticeRecord(
    createPracticeRecord(context, now),
    progress({
      currentQuestionId: input.questionId,
      inputs: { [input.questionId]: input },
    }),
  )
  writePracticeRecord(initial)
  const loaded = readPracticeRecord(context)
  const questions = [
    { id: answer.questionId, questionType: 'single', A: '选项A', B: '选项B' },
    { id: input.questionId, questionType: 'essay' },
  ]
  const restored = restorePracticeRecord(loaded, questions, {
    [answer.questionId]: answer.fingerprint,
    [input.questionId]: input.fingerprint,
  })
  assert.deepEqual(restored.answers[answer.questionId].values, ['A'])
  assert.equal(restored.inputs[input.questionId].text, input.text)
  assert.equal(restored.currentIndex, 1)
  const saved = updatePracticeRecord(
    restored.record,
    progress({
      currentQuestionId: input.questionId,
      inputs: restored.inputs,
      pendingSubmissionId: submissionId,
    }),
  )
  assert.equal(writePracticeRecord(saved), true)
  assert.deepEqual(readPracticeRecord(context), saved)
  assert.equal(saved.answerRevision, loaded.answerRevision)
})

test('题目变更剔除失效答案、输入和位置，使待提交失效，保留上次报告信息', () => {
  let record = updatePracticeRecord(createPracticeRecord(context, now), progress())
  record = updatePracticeRecord(record, progress({ pendingSubmissionId: submissionId }))
  record.inputs = { [input.questionId]: input }
  record.currentQuestionId = 'que_removed'
  record.lastSubmission = {
    submissionId,
    answerRevision: record.answerRevision,
    submittedAt: new Date(now).toISOString(),
  }
  const questions = [
    {
      id: answer.questionId,
      questionType: 'single',
      A: '选项A',
      B: '选项B',
    },
  ]
  const restored = restorePracticeRecord(record, questions, {
    [answer.questionId]: 'new fingerprint',
  })
  assert.deepEqual(restored.answers, {})
  assert.deepEqual(restored.inputs, {})
  assert.equal(restored.currentIndex, 0)
  assert.equal(restored.record.currentQuestionId, answer.questionId)
  assert.equal(restored.record.answerRevision, record.answerRevision + 1)
  assert.equal(restored.record.pendingSubmission, null)
  assert.deepEqual(restored.record.lastSubmission, record.lastSubmission)
})

test('登出清理当前账号所有来源，不影响其他账号或其他本地数据', () => {
  for (const source of ['practice', 'favorites', 'mistakes']) {
    writePracticeRecord(createPracticeRecord({ ...context, source }, now))
  }
  const other = { ...context, userId: 'usrother' }
  writePracticeRecord(createPracticeRecord(other, now))
  storage.setItem('passitai:auth-session', 'session')
  clearUserPracticeRecords(context.userId)
  // 另一个账号和登录信息仍在，同时保留本账号的清理屏障。
  assert.equal(storage.length, 3)
  assert.ok(readPracticeRecord(other))
  assert.equal(storage.getItem('passitai:auth-session'), 'session')
})

test('Storage 不可用时读写清理均不阻断页面流程', () => {
  Object.defineProperty(globalThis.window, 'localStorage', {
    get() {
      throw new Error('Storage unavailable')
    },
  })
  assert.equal(readPracticeRecord(context), null)
  assert.equal(writePracticeRecord(createPracticeRecord(context, now)), false)
  assert.doesNotThrow(() => clearPracticeRecords({ kind: 'paper', identity: context }))
  assert.doesNotThrow(() => clearUserPracticeRecords(context.userId))
})
