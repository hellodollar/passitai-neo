import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { preparePracticePaper, orderPracticePaper } = await loadSource('utils/practice/paper.ts')

function paperWithSections(counts) {
  let index = 0
  return {
    id: 'papUX',
    name: '综合练习',
    subjectId: 'subUX',
    questionCount: counts.reduce((sum, [, count]) => sum + count, 0),
    sections: counts.map(([questionType, count]) => ({
      name: questionType,
      questionType,
      items: Array.from({ length: count }, () => ({
        id: `qst${++index}`,
        title: '题干',
        questionType,
        A: '选项 A',
        B: '选项 B',
        C: null,
        D: null,
        E: null,
        F: null,
        correctAnswer: 'A',
        explanation: '',
      })),
    })),
  }
}

test('33 题按完整题型分组保留，第二组从全局第 21 题开始', () => {
  const { questions, groups } = preparePracticePaper(
    paperWithSections([
      ['single', 20],
      ['multiple', 10],
      ['shortAnswer', 3],
    ]),
  )
  assert.equal(questions.length, 33)
  assert.deepEqual(
    groups.map(({ startIndex, questions }) => [startIndex, questions.length]),
    [
      [0, 20],
      [20, 10],
      [30, 3],
    ],
  )
  assert.equal(groups[1].questions[0].id, questions[20].id)
  assert.equal(groups[2].questions[2].id, questions[32].id)
})

test('200 题在连续答题卡分组中完整保留，全局索引不重复或遗漏', () => {
  const { questions, groups } = preparePracticePaper(
    paperWithSections([
      ['single', 120],
      ['multiple', 60],
      ['essay', 20],
    ]),
  )
  const indexes = groups.flatMap((group) =>
    group.questions.map((question, offset) => {
      const index = group.startIndex + offset
      assert.equal(question.id, questions[index].id)
      return index
    }),
  )
  assert.deepEqual(
    indexes,
    Array.from({ length: 200 }, (_, index) => index),
  )
  assert.equal(groups.at(-1).questions.at(-1).id, 'qst200')
})

test('乱序在原分组内进行且不改变题目、选项、指纹或分组索引', () => {
  const source = paperWithSections([
    ['single', 20],
    ['multiple', 10],
    ['shortAnswer', 5],
  ])
  const before = JSON.stringify(source)
  const original = preparePracticePaper(source)
  const ordered = orderPracticePaper(original, 'round-1')
  assert.notDeepEqual(
    ordered.questions.map((question) => question.id),
    original.questions.map((question) => question.id),
  )
  assert.deepEqual(ordered.fingerprints, original.fingerprints)
  assert.equal(ordered.itemsById, original.itemsById)
  for (let index = 0; index < original.groups.length; index++) {
    assert.equal(ordered.groups[index].startIndex, original.groups[index].startIndex)
    assert.deepEqual(
      ordered.groups[index].questions.map((question) => question.id).sort(),
      original.groups[index].questions.map((question) => question.id).sort(),
    )
  }
  assert.equal(JSON.stringify(source), before)
})
test('同一轮刷新保持题序，新一轮种子改变题序，空组与单题正常', () => {
  const prepared = preparePracticePaper(
    paperWithSections([
      ['single', 20],
      ['multiple', 0],
      ['essay', 1],
    ]),
  )
  const ids = (seed) => orderPracticePaper(prepared, seed).questions.map((question) => question.id)
  assert.deepEqual(ids('round-1'), ids('round-1'))
  assert.notDeepEqual(ids('round-1'), ids('round-2'))
  assert.equal(orderPracticePaper(prepared, 'round-1').groups[1].questions.length, 0)
  assert.equal(orderPracticePaper(prepared, 'round-1').groups[2].questions.length, 1)
})

test('乱序后的作答与草稿按题目 ID 恢复，不串到其他题目', async () => {
  const { createPracticeRecord, updatePracticeRecord, restorePracticeRecord } = await loadSource(
    'utils/practice/record.ts',
  )
  const prepared = preparePracticePaper(paperWithSections([['single', 20]]))
  const startedAt = Date.now() - 1000
  const seed = `usrUX|papUX|${startedAt}`
  const ordered = orderPracticePaper(prepared, seed)
  const current = ordered.questions[3],
    draft = ordered.questions[5]
  const saved = updatePracticeRecord(
    createPracticeRecord(
      {
        userId: 'usrUX',
        paperId: 'papUX',
        source: 'practice',
        subjectId: 'subUX',
        paperType: 'pastExams',
      },
      startedAt,
    ),
    {
      startedAt,
      currentQuestionId: current.id,
      answers: {
        [current.id]: {
          questionId: current.id,
          fingerprint: prepared.fingerprints[current.id],
          values: ['A'],
          text: 'A',
        },
      },
      inputs: {
        [draft.id]: {
          questionId: draft.id,
          fingerprint: prepared.fingerprints[draft.id],
          values: ['B'],
          text: '',
        },
      },
      pendingSubmissionId: '',
      submissionAnswers: { [current.id]: 'A' },
    },
  )
  const again = orderPracticePaper(prepared, seed)
  const restored = restorePracticeRecord(saved, again.questions, prepared.fingerprints)
  assert.equal(restored.currentIndex, 3)
  assert.equal(again.questions[restored.currentIndex].id, current.id)
  assert.deepEqual(restored.answers[current.id].values, ['A'])
  assert.deepEqual(restored.inputs[draft.id].values, ['B'])
  assert.equal(Object.keys(restored.answers).length, 1)
})
