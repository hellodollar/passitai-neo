import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const {
  clearUserPracticeRecords,
  createPracticeRecord,
  readPracticeRecord,
  removePracticeRecord,
  restorePracticeRecord,
  updatePracticeRecord,
  writePracticeRecord,
} = await loadSource('utils/practice-record.ts')

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
  userId: 'usr_one',
  paperId: 'pap_one',
  source: 'practice',
  subjectId: 'sub_one',
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
const submissionId = 'rec_123456abcdef'
const legacyKey = (record = context) =>
  `passitai:practice-draft:v1:${record.userId}:${record.paperId}`
const recordKey = (record = context) =>
  `passitai:practice-record:v2:${encodeURIComponent(record.userId)}:${record.source}:${encodeURIComponent(record.paperId)}`
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

test('v1 迁移保留答案、未确认输入、位置、时间与待提交 ID，补齐分类信息', () => {
  storage.setItem(legacyKey(), JSON.stringify(legacyDraft()))
  const record = readPracticeRecord(context)
  assert.equal(record.version, 2)
  assert.equal(record.subjectId, 'sub_one')
  assert.equal(record.paperType, 'pastExam')
  assert.deepEqual(record.answers, { [answer.questionId]: answer })
  assert.deepEqual(record.inputs, { [input.questionId]: input })
  assert.equal(record.currentQuestionId, input.questionId)
  assert.equal(record.startedAt, now)
  assert.equal(record.savedAt, now)
  assert.equal(record.pendingSubmission.submissionId, submissionId)
  assert.equal(record.pendingSubmission.payload, null)
  assert.equal(record.pendingSubmission.answerRevision, record.answerRevision)
  assert.equal(record.lastSubmission, null)
  assert.equal(storage.getItem(legacyKey()), null)
  assert.deepEqual(JSON.parse(storage.getItem(recordKey())), record)
  assert.deepEqual(readPracticeRecord(context), record)
})

test('迁移写入失败仍可在内存恢复；旧草稿保留，恢复写入后可以重试迁移', () => {
  const original = JSON.stringify(legacyDraft())
  storage.setItem(legacyKey(), original)
  storage.failWrites = true
  assert.deepEqual(readPracticeRecord(context).answers, { [answer.questionId]: answer })
  assert.equal(storage.getItem(legacyKey()), original)
  assert.equal(storage.getItem(recordKey()), null)
  storage.failWrites = false
  assert.equal(readPracticeRecord(context).version, 2)
  assert.equal(storage.getItem(legacyKey()), null)
})

test('写入没有落盘或旧键删除失败时不会丢失迁移数据', () => {
  const original = JSON.stringify(legacyDraft())
  storage.setItem(legacyKey(), original)
  const originalSet = storage.setItem.bind(storage)
  storage.setItem = () => {}
  assert.equal(readPracticeRecord(context).version, 2)
  assert.equal(storage.getItem(legacyKey()), original)
  storage.setItem = originalSet
  storage.failRemovals = true
  assert.equal(readPracticeRecord(context).version, 2)
  assert.equal(storage.getItem(legacyKey()), original)
  assert.ok(storage.getItem(recordKey()))
})

test('已经存在的 v2 优先读取，不被再次出现的 v1 草稿覆盖', () => {
  const record = updatePracticeRecord(createPracticeRecord(context, now), progress())
  assert.equal(writePracticeRecord(record), true)
  storage.setItem(legacyKey(), JSON.stringify(legacyDraft({ answers: {}, inputs: {} })))
  assert.deepEqual(readPracticeRecord(context), record)
})

test('新键损坏但旧草稿仍在时，从旧数据恢复并重新完成迁移', () => {
  storage.setItem(recordKey(), '{invalid')
  storage.setItem(legacyKey(), JSON.stringify(legacyDraft()))
  const record = readPracticeRecord(context)
  assert.deepEqual(record.answers, { [answer.questionId]: answer })
  assert.deepEqual(JSON.parse(storage.getItem(recordKey())), record)
  assert.equal(storage.getItem(legacyKey()), null)
})

test('损坏、版本不符或用户不符的旧数据不迁移、不删除', () => {
  for (const raw of [
    'bad json',
    JSON.stringify(legacyDraft({ version: 0 })),
    JSON.stringify(legacyDraft({ userId: 'usr_other' })),
  ]) {
    storage.setItem(legacyKey(), raw)
    assert.equal(readPracticeRecord(context), null)
    assert.equal(storage.getItem(legacyKey()), raw)
    assert.equal(storage.getItem(recordKey()), null)
  }
})

test('新记录按用户、题集和训练来源隔离，包括相同 fav: ID', () => {
  const identities = [
    { ...context, source: 'favorites', paperId: 'fav:sub_one', paperType: null },
    { ...context, source: 'wrong-questions', paperId: 'fav:sub_one', paperType: null },
    { ...context, source: 'favorites', paperId: 'fav:pap_one', paperType: null },
    {
      ...context,
      userId: 'usr_other',
      source: 'favorites',
      paperId: 'fav:sub_one',
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
  removePracticeRecord(identities[0])
  assert.equal(readPracticeRecord(identities[0]), null)
  assert.ok(readPracticeRecord(identities[1]))
})

test('v1 的共享集合草稿只迁移到首次访问来源，不复制给另一个来源', () => {
  const favorites = { ...context, source: 'favorites', paperId: 'fav:sub_one', paperType: null }
  const wrong = { ...favorites, source: 'wrong-questions' }
  storage.setItem(
    legacyKey(favorites),
    JSON.stringify(legacyDraft({ paperId: favorites.paperId, pendingSubmissionId: '' })),
  )
  assert.equal(readPracticeRecord(favorites).source, 'favorites')
  assert.equal(readPracticeRecord(wrong), null)
})

test('旧集合键删除失败，也不会再次迁移到另一个训练来源', () => {
  const favorites = { ...context, source: 'favorites', paperId: 'fav:sub_one', paperType: null }
  const wrong = { ...favorites, source: 'wrong-questions' }
  storage.setItem(
    legacyKey(favorites),
    JSON.stringify(legacyDraft({ paperId: favorites.paperId, pendingSubmissionId: '' })),
  )
  storage.failRemovals = true
  assert.ok(readPracticeRecord(favorites))
  assert.ok(storage.getItem(legacyKey(favorites)))
  assert.equal(readPracticeRecord(wrong), null)
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

test('旧待提交 ID 在当前题目加载后补齐快照，保持原始 ID 和答案版本', () => {
  storage.setItem(legacyKey(), JSON.stringify(legacyDraft()))
  const migrated = readPracticeRecord(context)
  const updated = updatePracticeRecord(migrated, progress({ pendingSubmissionId: submissionId }))
  assert.equal(updated.answerRevision, migrated.answerRevision)
  assert.deepEqual(updated.pendingSubmission.payload, {
    submissionId,
    userAnswers: { [answer.questionId]: 'A' },
    startTime: new Date(now).toISOString(),
  })
})

test('迁移、按题目恢复、页面保存、刷新读取的完整链路保留作答', () => {
  storage.setItem(legacyKey(), JSON.stringify(legacyDraft()))
  const migrated = readPracticeRecord(context)
  const questions = [
    { id: answer.questionId, questionType: 'single', A: '选项A', B: '选项B' },
    { id: input.questionId, questionType: 'essay' },
  ]
  const restored = restorePracticeRecord(migrated, questions, {
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
  assert.equal(saved.answerRevision, migrated.answerRevision)
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

test('登出清理当前账号所有来源及未迁移草稿，不影响其他账号或其他本地数据', () => {
  for (const source of ['practice', 'favorites', 'wrong-questions']) {
    writePracticeRecord(createPracticeRecord({ ...context, source }, now))
  }
  const other = { ...context, userId: 'usr_other' }
  writePracticeRecord(createPracticeRecord(other, now))
  storage.setItem(legacyKey(), JSON.stringify(legacyDraft()))
  storage.setItem(legacyKey(other), 'other legacy')
  storage.setItem('passitai:auth-session', 'session')
  clearUserPracticeRecords(context.userId)
  // 三份非目标数据仍在，另保留一份本账号的清理屏障。
  assert.equal(storage.length, 4)
  assert.ok(readPracticeRecord(other))
  assert.equal(storage.getItem(legacyKey(other)), 'other legacy')
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
  assert.doesNotThrow(() => removePracticeRecord(context))
  assert.doesNotThrow(() => clearUserPracticeRecords(context.userId))
})
