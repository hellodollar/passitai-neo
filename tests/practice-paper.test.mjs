import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { preparePracticePaper } = await loadSource('utils/practice/paper.ts')

function paperWithSections(counts) {
  let index = 0
  return {
    id: 'papUX', name: '综合练习', subjectId: 'subUX',
    questionCount: counts.reduce((sum, [, count]) => sum + count, 0),
    sections: counts.map(([questionType, count]) => ({
      name: questionType,
      questionType,
      items: Array.from({ length: count }, () => ({
        id: `qst${++index}`, title: '题干', questionType,
        A: '选项 A', B: '选项 B', C: null, D: null, E: null, F: null,
        correctAnswer: 'A', explanation: '',
      })),
    })),
  }
}

test('33 题按完整题型分组保留，第二组从全局第 21 题开始', () => {
  const { questions, groups } = preparePracticePaper(
    paperWithSections([['single', 20], ['multiple', 10], ['shortAnswer', 3]]),
  )
  assert.equal(questions.length, 33)
  assert.deepEqual(groups.map(({ startIndex, questions }) => [startIndex, questions.length]), [
    [0, 20], [20, 10], [30, 3],
  ])
  assert.equal(groups[1].questions[0].id, questions[20].id)
  assert.equal(groups[2].questions[2].id, questions[32].id)
})

test('200 题在连续答题卡分组中完整保留，全局索引不重复或遗漏', () => {
  const { questions, groups } = preparePracticePaper(
    paperWithSections([['single', 120], ['multiple', 60], ['essay', 20]]),
  )
  const indexes = groups.flatMap((group) => group.questions.map((question, offset) => {
    const index = group.startIndex + offset
    assert.equal(question.id, questions[index].id)
    return index
  }))
  assert.deepEqual(indexes, Array.from({ length: 200 }, (_, index) => index))
  assert.equal(groups.at(-1).questions.at(-1).id, 'qst200')
})
