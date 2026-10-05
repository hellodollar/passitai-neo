import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const {
  getQuestionSheetRanges,
  getVisibleQuestionSheetGroups,
} = await loadSource('utils/question-sheet.ts')

test('200 道题分为 10 个区间，最后一段仍包含第 200 题', () => {
  const ranges = getQuestionSheetRanges(200)
  assert.equal(ranges.length, 10)
  assert.deepEqual(ranges[0], { index: 0, label: '1–20', start: 0, end: 20 })
  assert.deepEqual(ranges[9], { index: 9, label: '181–200', start: 180, end: 200 })
  assert.deepEqual(getQuestionSheetRanges(0), [])
})

test('题号区间跨题型分组时保留全局索引', () => {
  const groups = [
    { key: 'single', label: '单选题', startIndex: 0, questions: Array.from({ length: 12 }, (_, id) => ({ id })) },
    { key: 'multiple', label: '多选题', startIndex: 12, questions: Array.from({ length: 13 }, (_, id) => ({ id: id + 12 })) },
  ]

  const first = getVisibleQuestionSheetGroups(groups, 25, 0)
  assert.deepEqual(first.map(({ startIndex, questions }) => [startIndex, questions.length]), [[0, 12], [12, 8]])

  const second = getVisibleQuestionSheetGroups(groups, 25, 1)
  assert.deepEqual(second.map(({ startIndex, questions }) => [startIndex, questions.length]), [[20, 5]])
  assert.equal(second[0].questions[0].id, 20)
  assert.equal(groups[1].questions.length, 13)
})
