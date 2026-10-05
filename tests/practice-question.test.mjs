import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { getCorrectOptionValues, getQuestionOptions, isAnswerCorrect } =
  await loadSource('utils/practice-question.ts')

const question = {
  id: 'qst_000000000001',
  subjectId: 'sub_000000000001',
  title: '哪些说法正确？',
  questionType: 'multiple',
  A: '选项一',
  B: '选项二',
  C: '选项三',
  D: '选项四',
  E: null,
  F: null,
  correctAnswer: 'ABC',
  explanation: null,
}

test('多选答案 ABC 解析为三个选项，少选 AB 判为错误', () => {
  assert.deepEqual(getCorrectOptionValues(question, getQuestionOptions(question)), ['A', 'B', 'C'])
  assert.equal(isAnswerCorrect({ questionId: question.id, text: 'A、B', values: ['A', 'B'] }, question), false)
  assert.equal(isAnswerCorrect({ questionId: question.id, text: 'C、A、B', values: ['C', 'A', 'B'] }, question), true)
})
