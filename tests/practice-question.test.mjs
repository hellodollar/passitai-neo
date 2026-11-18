import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { getCorrectOptionValues, getQuestionOptions, isAnswerCorrect } = await loadSource(
  'utils/practice/question.ts',
)
const { buildSubmissionResult } = await loadSource('utils/practice/result.ts')

const question = {
  id: 'qst000000000001',
  subjectId: 'sub000000000001',
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
  assert.equal(
    isAnswerCorrect({ questionId: question.id, text: 'A、B', values: ['A', 'B'] }, question),
    false,
  )
  assert.equal(
    isAnswerCorrect(
      { questionId: question.id, text: 'C、A、B', values: ['C', 'A', 'B'] },
      question,
    ),
    true,
  )
})

test('作答判分与交卷报告共用同一套答案解析规则（支持判断题与主观题待批阅）', () => {
  const judgeItem = {
    ...question,
    id: 'qst000000000002',
    questionType: 'judge',
    A: '正确',
    B: '错误',
    C: null,
    D: null,
    correctAnswer: 'TRUE',
  }
  const essayItem = {
    ...question,
    id: 'qst000000000003',
    questionType: 'essay',
    A: null,
    B: null,
    C: null,
    D: null,
    correctAnswer: '参考要点',
  }
  assert.equal(
    isAnswerCorrect({ questionId: judgeItem.id, text: '正确', values: ['A'] }, judgeItem),
    true,
  )
  const report = buildSubmissionResult(
    {
      paper: {
        id: 'pap1',
        name: '测试卷',
        subjectId: 'sub1',
        type: 'specialTraining',
        assessmentType: 'overall',
        questionCount: 3,
        sections: [{ name: '综合', items: [question, judgeItem, essayItem] }],
      },
      favoriteQuestionIds: [],
      latestRecord: null,
    },
    {
      id: 'rec000000000001',
      paperId: 'pap1',
      recordStatus: 'completed',
      userAnswers: {
        [question.id]: ['C', 'A', 'B'],
        [judgeItem.id]: '正确',
        [essayItem.id]: '主观作答',
      },
      score: null,
      startTime: null,
      endTime: null,
    },
    'pap1',
    '科目一',
  )
  assert.deepEqual(
    report.questions.map((item) => item.status),
    ['correct', 'correct', 'pending'],
  )
})
