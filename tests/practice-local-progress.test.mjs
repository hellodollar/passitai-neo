import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const {
  createPracticeRecord,
  updatePracticeRecord,
  readPracticeRecord,
  writePracticeRecord,
  listPracticeRecords,
  clearPracticeRecords,
  clearUserPracticeRecords,
} = await loadSource('utils/practice/record.ts')
const { isPracticeRecordCurrent, subscribePracticeRecordChanges } = await loadSource(
  'utils/practice/record-control.ts',
)
const { preparePracticeSubmission, settlePracticeSubmission } = await loadSource(
  'utils/practice/submission.ts',
)
const { applyLocalPracticeProgress } = await loadSource('utils/practice/progress.ts')

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
    if (this.failWrites) throw new Error('quota')
    this.items.set(key, String(value))
  }
  removeItem(key) {
    if (this.failRemovals) throw new Error('blocked')
    this.items.delete(key)
  }
}
const context = {
  userId: 'usrone',
  paperId: 'papone',
  subjectId: 'subone',
  source: 'practice',
  paperType: 'pastExam',
}
const answer = { questionId: 'que_one', fingerprint: 'fp1', text: '甲', values: ['A'] }
const input = { questionId: 'que_two', fingerprint: 'fp2', text: '未确认', values: [] }
const recordKey = (ctx = context) =>
  `passitai:practice-record:v3:${encodeURIComponent(ctx.userId)}:${ctx.source}:${encodeURIComponent(ctx.paperId)}`
const legacyKey = (ctx = context) => `passitai:practice-draft:v1:${ctx.userId}:${ctx.paperId}`
const makeRecord = (ctx = context) =>
  updatePracticeRecord(createPracticeRecord(ctx), {
    startedAt: Date.now(),
    currentQuestionId: 'que_two',
    answers: { que_one: answer },
    inputs: { que_two: input },
    pendingSubmissionId: '',
    submissionAnswers: { que_one: 'A' },
  })
const entries = [
  {
    type: 'pastExam',
    name: '历年真题',
    answeredCount: 999,
    questionCount: 8,
    children: [{ paperId: 'papone', name: '测试', answeredCount: 999, questionCount: 8 }],
  },
]
const previousWindow = globalThis.window
const previousDocument = globalThis.document
let storage
beforeEach(() => {
  storage = new MemoryStorage()
  globalThis.window = Object.assign(new EventTarget(), { localStorage: storage })
  globalThis.document = Object.assign(new EventTarget(), { visibilityState: 'visible' })
})
afterEach(() => {
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
  if (previousDocument === undefined) delete globalThis.document
  else globalThis.document = previousDocument
})

test('首页进度只取本地已确认答案；没有记录为 0，接口进度不参与且不修改目录', () => {
  const record = makeRecord()
  const mapped = applyLocalPracticeProgress(entries, [record], context.userId, context.subjectId)
  assert.equal(mapped[0].children[0].answeredCount, 1)
  assert.equal(mapped[0].answeredCount, 1)
  assert.equal(entries[0].children[0].answeredCount, 999)
  assert.equal(
    applyLocalPracticeProgress(entries, [], context.userId, context.subjectId)[0].answeredCount,
    0,
  )
  for (const mismatch of [
    { ...record, userId: 'usrother' },
    { ...record, subjectId: 'subother' },
    { ...record, source: 'favorites' },
    { ...record, paperType: 'mock' },
  ]) {
    assert.equal(
      applyLocalPracticeProgress(entries, [mismatch], context.userId, context.subjectId)[0]
        .answeredCount,
      0,
    )
  }
})

test('本地进度按题集累加且不超过题目总数，未确认输入不计数', () => {
  const record = makeRecord()
  record.answers.que_empty = { ...answer, questionId: 'que_empty', text: '', values: [] }
  const second = {
    ...makeRecord({ ...context, paperId: 'paptwo' }),
    answers: { que_a: answer, que_b: answer },
  }
  const directory = [
    {
      ...entries[0],
      children: [
        ...entries[0].children,
        { paperId: 'paptwo', name: '第二集', questionCount: 1, answeredCount: 0 },
      ],
    },
  ]
  const mapped = applyLocalPracticeProgress(
    directory,
    [record, second],
    context.userId,
    context.subjectId,
  )
  assert.equal(mapped[0].answeredCount, 2)
  assert.deepEqual(
    mapped[0].children.map((child) => child.answeredCount),
    [1, 1],
  )
})

test('单题集清除答案、输入、位置及提交状态，不删除另一个来源或账号记录', () => {
  const original = makeRecord()
  original.pendingSubmission = {
    submissionId: 'rec123456abcdef',
    answerRevision: original.answerRevision,
    payload: {
      submissionId: 'rec123456abcdef',
      userAnswers: { que_one: 'A' },
      startTime: new Date(original.startedAt).toISOString(),
    },
  }
  original.lastSubmission = {
    submissionId: 'recabcdef123456',
    answerRevision: 0,
    submittedAt: new Date().toISOString(),
  }
  writePracticeRecord(original)
  const otherSource = { ...context, source: 'favorites', paperType: null }
  const otherUser = { ...context, userId: 'usrother' }
  writePracticeRecord(makeRecord(otherSource))
  writePracticeRecord(makeRecord(otherUser))
  assert.equal(clearPracticeRecords({ kind: 'paper', identity: context }), true)
  assert.equal(readPracticeRecord(context), null)
  assert.equal(writePracticeRecord(original), false)
  assert.ok(readPracticeRecord(otherSource))
  assert.ok(readPracticeRecord(otherUser))
  const newRecord = createPracticeRecord(context)
  assert.notEqual(newRecord.clearToken, original.clearToken)
  assert.deepEqual(newRecord.answers, {})
  assert.equal(writePracticeRecord(makeRecord(context)), true)
})

test('分类清理跨科目覆盖全部目标题集，其他分类和收藏、错题均不受影响', () => {
  const contexts = [
    context,
    { ...context, paperId: 'paptwo', subjectId: 'subtwo' },
    { ...context, paperId: 'papmock', paperType: 'mock' },
    { ...context, paperId: 'collection:subject:subone', source: 'favorites', paperType: null },
    { ...context, paperId: 'collection:subject:subone', source: 'mistakes', paperType: null },
  ]
  const records = contexts.map((ctx) => makeRecord(ctx))
  records.forEach(writePracticeRecord)
  assert.equal(
    clearPracticeRecords({ kind: 'category', userId: context.userId, paperType: 'pastExam' }),
    true,
  )
  assert.equal(readPracticeRecord(contexts[0]), null)
  assert.equal(readPracticeRecord(contexts[1]), null)
  contexts.slice(2).forEach((ctx) => assert.ok(readPracticeRecord(ctx)))
  assert.equal(listPracticeRecords(context.userId).length, 3)
  assert.equal(writePracticeRecord(records[0]), false)
  assert.equal(writePracticeRecord(records[1]), false)
})

test('缺失 clearToken 的记录不会被解释为当前代际', () => {
  const invalid = makeRecord()
  delete invalid.clearToken
  storage.setItem(recordKey(), JSON.stringify(invalid))
  assert.equal(readPracticeRecord(context), null)
  assert.deepEqual(listPracticeRecords(context.userId), [])
})

test('列表只包含当前版本，旧草稿与旧记录不会进入进度统计', () => {
  const oldRecord = { ...makeRecord(), version: 2 }
  storage.setItem(recordKey().replace(':v3:', ':v2:'), JSON.stringify(oldRecord))
  storage.setItem(legacyKey(), JSON.stringify({ ...oldRecord, version: 1 }))
  assert.deepEqual(listPracticeRecords(context.userId), [])
  assert.equal(readPracticeRecord(context), null)
})

test('清除全部含收藏和错题本地作答，不碰其他用户、登录和刷题设置', () => {
  for (const source of ['practice', 'favorites', 'mistakes'])
    writePracticeRecord(makeRecord({ ...context, source }))
  const other = { ...context, userId: 'usrother' }
  writePracticeRecord(makeRecord(other))
  storage.setItem('passitai:auth-session', 'auth')
  storage.setItem('practice-settings', 'settings')
  assert.equal(clearPracticeRecords({ kind: 'all', userId: context.userId }), true)
  assert.deepEqual(listPracticeRecords(context.userId), [])
  assert.ok(readPracticeRecord(other))
  assert.equal(storage.getItem('passitai:auth-session'), 'auth')
  assert.equal(storage.getItem('practice-settings'), 'settings')
})

test('屏障写入失败时手动清理不伪报成功，也不删除原记录；登出尽力清除', () => {
  writePracticeRecord(makeRecord())
  storage.failWrites = true
  assert.equal(clearPracticeRecords({ kind: 'all', userId: context.userId }), false)
  assert.ok(readPracticeRecord(context))
  assert.equal(clearUserPracticeRecords(context.userId), true)
  assert.equal(storage.getItem(recordKey()), null)
})

test('删除原键失败时屏障仍使旧记录不可读、不可回写，不影响重新作答', () => {
  const old = makeRecord()
  writePracticeRecord(old)
  storage.failRemovals = true
  assert.equal(clearPracticeRecords({ kind: 'paper', identity: context }), true)
  assert.ok(storage.getItem(recordKey()))
  assert.equal(readPracticeRecord(context), null)
  assert.equal(isPracticeRecordCurrent(old), false)
  assert.equal(writePracticeRecord(old), false)
  assert.equal(writePracticeRecord(makeRecord()), true)
})

test('清理后的迟到交卷响应不能登记报告，也不能复用旧提交', () => {
  const old = preparePracticeSubmission(makeRecord(), { que_one: 'A' }, () => 'rec123456abcdef')
  const response = {
    id: old.pending.submissionId,
    paperId: context.paperId,
    userAnswers: old.pending.payload.userAnswers,
    startTime: old.pending.payload.startTime,
    endTime: new Date().toISOString(),
    recordStatus: 'completed',
    score: null,
  }
  clearPracticeRecords({ kind: 'paper', identity: context })
  assert.throws(() => preparePracticeSubmission(old.record, { que_one: 'A' }))
  assert.throws(() => settlePracticeSubmission(makeRecord(), old.record, response))
})

test('先后清理不同分类或单题集保留独立屏障，不使之前清理的记录重新有效', () => {
  const past = makeRecord()
  const mock = makeRecord({ ...context, paperId: 'papmock', paperType: 'mock' })
  clearPracticeRecords({ kind: 'category', userId: context.userId, paperType: 'pastExam' })
  clearPracticeRecords({ kind: 'category', userId: context.userId, paperType: 'mock' })
  clearPracticeRecords({ kind: 'paper', identity: { ...context, paperId: 'papother' } })
  assert.equal(isPracticeRecordCurrent(past), false)
  assert.equal(isPracticeRecordCurrent(mock), false)
})

test('清理扫描后新一轮已写入的同键记录不会被删除', () => {
  writePracticeRecord(makeRecord())
  const originalSet = storage.setItem.bind(storage)
  storage.setItem = (key, value) => {
    originalSet(key, value)
    if (key.startsWith('passitai:practice-record-clear:')) {
      const fresh = makeRecord()
      fresh.answers.que_new = { ...answer, questionId: 'que_new' }
      originalSet(recordKey(), JSON.stringify(fresh))
    }
  }
  assert.equal(clearPracticeRecords({ kind: 'all', userId: context.userId }), true)
  assert.ok(readPracticeRecord(context).answers.que_new)
})

test('写入期间发生清理时，二次代际检查阻止刚写入的旧记录复活', () => {
  const old = makeRecord()
  const originalSet = storage.setItem.bind(storage)
  storage.setItem = (key, value) => {
    originalSet(key, value)
    if (key === recordKey()) clearPracticeRecords({ kind: 'paper', identity: context })
  }
  assert.equal(writePracticeRecord(old), false)
  assert.equal(readPracticeRecord(context), null)
})

test('同页保存/清理和跨标签 storage 事件通知进度订阅；解绑后不再响应', () => {
  let changes = 0
  const unsubscribe = subscribePracticeRecordChanges(() => {
    changes++
  })
  writePracticeRecord(makeRecord())
  assert.equal(changes, 1)
  clearPracticeRecords({ kind: 'all', userId: context.userId })
  assert.equal(changes, 2)
  window.dispatchEvent(Object.assign(new Event('storage'), { key: recordKey() }))
  assert.equal(changes, 3)
  window.dispatchEvent(Object.assign(new Event('storage'), { key: 'unrelated' }))
  assert.equal(changes, 3)
  document.dispatchEvent(new Event('visibilitychange'))
  assert.equal(changes, 4)
  unsubscribe()
  window.dispatchEvent(Object.assign(new Event('storage'), { key: null }))
  assert.equal(changes, 4)
})
