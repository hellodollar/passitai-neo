import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { preparePracticeSubmission, settlePracticeSubmission } = await loadSource(
  'utils/practice-submission.ts',
)
const {
  createPracticeRecord,
  updatePracticeRecord,
  writePracticeRecord,
  readPracticeRecord,
  restorePracticeRecord,
} = await loadSource('utils/practice-record.ts')
const { toSubmissionAnswers } = await loadSource('utils/submission-answers.ts')
const { buildSubmissionResult } = await loadSource('utils/practice-result.ts')

const startedAt = Date.now() - 1000
const context = {
  userId: 'usr_one',
  paperId: 'pap_one',
  source: 'practice',
  subjectId: 'sub_one',
  paperType: 'pastExam',
}
const questions = [
  { id: 'que_one', questionType: 'single', title: '单选', A: '甲', B: '乙', correctAnswer: 'A' },
  { id: 'que_two', questionType: 'multiple', title: '多选', A: '甲', B: '乙', correctAnswer: 'AB' },
  { id: 'que_three', questionType: 'essay', title: '论述', correctAnswer: '参考答案' },
]
const fingerprints = { que_one: 'fp1', que_two: 'fp2', que_three: 'fp3' }
const single = { questionId: 'que_one', fingerprint: 'fp1', text: '甲', values: ['A'] }
const multiple = { questionId: 'que_two', fingerprint: 'fp2', text: '甲、乙', values: ['A', 'B'] }
const textInput = { questionId: 'que_three', fingerprint: 'fp3', text: '未确认', values: [] }
const id1 = 'rec_123456abcdef'
const id2 = 'rec_abcdef123456'
const createRecord = (answers = {}, inputs = {}) =>
  updatePracticeRecord(createPracticeRecord(context, startedAt), {
    startedAt,
    currentQuestionId: 'que_three',
    answers,
    inputs,
    pendingSubmissionId: '',
    submissionAnswers: toSubmissionAnswers(answers, questions),
  })
const response = (plan, overrides = {}) => ({
  id: plan.pending.submissionId,
  paperId: context.paperId,
  recordStatus: 'completed',
  userAnswers: structuredClone(plan.pending.payload.userAnswers),
  score: null,
  startTime: plan.pending.payload.startTime,
  endTime: new Date().toISOString(),
  ...overrides,
})
const previousWindow = globalThis.window
beforeEach(() => {
  const items = new Map()
  globalThis.window = {
    localStorage: {
      getItem: (key) => items.get(key) ?? null,
      setItem: (key, value) => items.set(key, String(value)),
    },
  }
})
afterEach(() => {
  if (previousWindow === undefined) delete globalThis.window
  else globalThis.window = previousWindow
})

test('全部已答、部分已答、零作答均可交卷并生成报告，未确认输入不算已答', () => {
  const detail = { paper: { name: '测试题集', sections: [{ items: questions }] } }
  const textAnswer = { ...textInput, text: '已确认答案' }
  for (const [answers, expectedCount] of [
    [{ que_one: single, que_two: multiple, que_three: textAnswer }, 3],
    [{ que_one: single }, 1],
    [{}, 0],
  ]) {
    const record = createRecord(answers, { que_three: textInput })
    const payload = toSubmissionAnswers(record.answers, questions)
    const plan = preparePracticeSubmission(record, payload, () => id1)
    assert.equal(plan.kind, 'submit')
    const submission = response(plan)
    const report = buildSubmissionResult(detail, submission, context.paperId, '科目')
    assert.equal(report.answeredCount, expectedCount)
    assert.equal(report.unansweredCount, 3 - expectedCount)
    const saved = settlePracticeSubmission(plan.record, plan.record, submission)
    assert.deepEqual(saved.answers, record.answers)
    assert.deepEqual(saved.inputs, record.inputs)
    assert.equal(saved.currentQuestionId, 'que_three')
    assert.equal(saved.pendingSubmission, null)
    assert.equal(saved.lastSubmission.submissionId, id1)
  }
})

test('交卷落盘后重入仍恢复答案、输入、位置；答案版本未变化时直接复用报告', () => {
  const original = createRecord({ que_one: single }, { que_three: textInput })
  const plan = preparePracticeSubmission(original, { que_one: 'A' }, () => id1)
  const submitted = settlePracticeSubmission(plan.record, plan.record, response(plan))
  assert.equal(writePracticeRecord(submitted), true)
  const restored = restorePracticeRecord(readPracticeRecord(context), questions, fingerprints)
  assert.deepEqual(restored.answers.que_one.values, ['A'])
  assert.deepEqual(restored.inputs.que_three, textInput)
  assert.equal(restored.currentIndex, 2)
  const next = preparePracticeSubmission(restored.record, { que_one: 'A' }, () => {
    assert.fail('重复交卷不应生成新 ID')
  })
  assert.equal(next.kind, 'report')
  assert.equal(next.submissionId, id1)
})

test('切题或编辑未确认输入不生成新报告；补答确认后生成新的交卷快照', () => {
  const first = preparePracticeSubmission(
    createRecord({ que_one: single }),
    { que_one: 'A' },
    () => id1,
  )
  const saved = settlePracticeSubmission(first.record, first.record, response(first))
  const edit = (answers) =>
    updatePracticeRecord(saved, {
      startedAt,
      currentQuestionId: 'que_two',
      answers,
      inputs: { que_three: textInput },
      pendingSubmissionId: '',
      submissionAnswers: toSubmissionAnswers(answers, questions),
    })
  assert.equal(preparePracticeSubmission(edit(saved.answers), { que_one: 'A' }).kind, 'report')
  const updated = edit({ ...saved.answers, que_two: multiple })
  const next = preparePracticeSubmission(
    updated,
    toSubmissionAnswers(updated.answers, questions),
    () => id2,
  )
  assert.equal(next.kind, 'submit')
  assert.equal(next.pending.submissionId, id2)
  assert.deepEqual(next.pending.payload.userAnswers, { que_one: 'A', que_two: ['A', 'B'] })
  assert.equal(updated.lastSubmission.submissionId, id1)
  // 新增答案不改变已经交卷的报告快照。
  assert.deepEqual(first.pending.payload.userAnswers, { que_one: 'A' })
})

test('请求失败、刷新后重试固定 ID、答案和开始时间，不采用新输入重建请求', () => {
  const record = createRecord({ que_two: multiple })
  const payload = { que_two: ['A', 'B'] }
  const first = preparePracticeSubmission(record, payload, () => id1)
  payload.que_two.push('C')
  assert.equal(writePracticeRecord(first.record), true)
  const reloaded = readPracticeRecord(context)
  const retry = preparePracticeSubmission(reloaded, { que_two: ['C'] }, () => {
    assert.fail('失败重试不应生成新 ID')
  })
  assert.deepEqual(retry.pending, first.pending)
  assert.deepEqual(retry.pending.payload.userAnswers.que_two, ['A', 'B'])
  assert.equal(retry.pending.payload.startTime, new Date(startedAt).toISOString())
})

test('旧迁移记录补齐快照时沿用原待提交 ID', () => {
  const record = createRecord({ que_one: single })
  record.pendingSubmission = {
    submissionId: id1,
    answerRevision: record.answerRevision,
    payload: null,
  }
  const plan = preparePracticeSubmission(record, { que_one: 'A' }, () => assert.fail('不要重建 ID'))
  assert.equal(plan.pending.submissionId, id1)
  assert.deepEqual(plan.pending.payload.userAnswers, { que_one: 'A' })
})

test('超时提交恢复成功只登记报告，不清除本地作答；下次交卷可复用结果', () => {
  const plan = preparePracticeSubmission(
    createRecord({ que_one: single }),
    { que_one: 'A' },
    () => id1,
  )
  writePracticeRecord(plan.record)
  const local = readPracticeRecord(context)
  const resolved = settlePracticeSubmission(local, local, response(plan))
  writePracticeRecord(resolved)
  assert.deepEqual(readPracticeRecord(context).answers, local.answers)
  assert.equal(preparePracticeSubmission(resolved, { que_one: 'A' }).kind, 'report')
})

test('旧请求迟到不能清除补答后的新快照、输入或覆盖更新的报告', () => {
  const first = preparePracticeSubmission(
    createRecord({ que_one: single }),
    { que_one: 'A' },
    () => id1,
  )
  const changed = updatePracticeRecord(first.record, {
    startedAt,
    currentQuestionId: 'que_two',
    answers: { que_one: single, que_two: multiple },
    inputs: { que_three: textInput },
    pendingSubmissionId: '',
    submissionAnswers: { que_one: 'A', que_two: ['A', 'B'] },
  })
  const second = preparePracticeSubmission(
    changed,
    { que_one: 'A', que_two: ['A', 'B'] },
    () => id2,
  )
  const late = settlePracticeSubmission(second.record, first.record, response(first))
  assert.deepEqual(late.pendingSubmission, second.pending)
  assert.deepEqual(late.answers, changed.answers)
  assert.deepEqual(late.inputs, changed.inputs)
  const newer = settlePracticeSubmission(late, second.record, response(second))
  const lateAgain = settlePracticeSubmission(newer, first.record, response(first))
  assert.equal(lateAgain.lastSubmission.submissionId, id2)
  assert.equal(lateAgain.pendingSubmission, null)
})

test('其他账号、题集、来源或不匹配的交卷响应不能登记到当前记录', () => {
  const plan = preparePracticeSubmission(createRecord(), {}, () => id1)
  for (const invalid of [
    { ...plan.record, userId: 'usr_two' },
    { ...plan.record, paperId: 'pap_two' },
    { ...plan.record, source: 'favorites' },
    { ...plan.record, answerRevision: -1 },
  ]) {
    assert.throws(() => settlePracticeSubmission(invalid, plan.record, response(plan)))
  }
  assert.throws(() =>
    settlePracticeSubmission(plan.record, plan.record, response(plan, { id: id2 })),
  )
  assert.throws(() =>
    settlePracticeSubmission(plan.record, plan.record, response(plan, { paperId: 'pap_two' })),
  )
  assert.throws(() => preparePracticeSubmission({ ...plan.record, source: 'wrong-questions' }, {}))
})

test('默认生成的提交 ID 满足接口格式，缺失交卷时间时使用确认时间', () => {
  const plan = preparePracticeSubmission(createRecord(), {})
  assert.match(plan.pending.submissionId, /^rec_[0-9a-f]{12}$/)
  const saved = settlePracticeSubmission(
    plan.record,
    plan.record,
    response(plan, { endTime: null }),
    startedAt,
  )
  assert.equal(saved.lastSubmission.submittedAt, new Date(startedAt).toISOString())
})
