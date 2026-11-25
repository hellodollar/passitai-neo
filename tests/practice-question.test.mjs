import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { getCorrectOptionValues, getQuestionOptions, isAnswerCorrect } = await loadSource(
  'utils/practice/question.ts',
)
const { buildSubmissionResult, estimateSubjectiveSelfGrade } = await loadSource(
  'utils/practice/result.ts',
)

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
  const toPaperQuestion = (item) => ({
    id: item.id,
    subjectCode: 'GD-15043',
    title: item.title,
    type: item.questionType,
    A: item.A,
    B: item.B,
    C: item.C,
    D: item.D,
    E: item.E,
    F: item.F,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
  })
  const report = buildSubmissionResult(
    {
      id: 'pap1',
      subjectCode: 'GD-15043',
      provinceCode: '440000',
      name: '测试卷',
      type: 'pointCoverage',
      paperMode: 'exam',
      contentPeriod: '2026-04',
      sourceType: 'system',
      questionCount: 3,
      sections: [
        {
          name: '综合',
          questionIds: [question.id, judgeItem.id, essayItem.id],
          items: [question, judgeItem, essayItem].map(toPaperQuestion),
        },
      ],
    },
    {
      id: 'rec000000000001',
      subjectCode: 'GD-15043',
      paperId: 'pap1',
      paperName: '测试卷',
      userAnswers: {
        [question.id]: ['C', 'A', 'B'],
        [judgeItem.id]: '正确',
        [essayItem.id]: '主观作答',
      },
      totalQuestions: 3,
      answeredCount: 3,
      objectiveTotal: 2,
      objectiveCorrect: 2,
      objectiveScore: 50,
      subjectiveScore: null,
      score: null,
      durationSeconds: 45,
      createdAt: '2026-11-24T10:00:00Z',
    },
    '科目一',
  )
  assert.deepEqual(
    report.questions.map((item) => item.status),
    ['correct', 'correct', 'pending'],
  )
})

test('选答题自评预计得分按最高 answerCount 题汇总封顶，已自评后题目状态更新为 graded', () => {
  const toEssay = (id) => ({
    id,
    subjectCode: 'GD-15043',
    title: `论述 ${id}`,
    type: 'essay',
    A: null,
    B: null,
    C: null,
    D: null,
    E: null,
    F: null,
    correctAnswer: '要点',
    explanation: null,
  })
  const paper = {
    id: 'pap-sel',
    subjectCode: 'GD-15043',
    provinceCode: '440000',
    name: '选答模拟卷',
    type: 'pointCoverage',
    paperMode: 'exam',
    contentPeriod: '2027-01',
    sourceType: 'system',
    questionCount: 3,
    sections: [
      {
        name: '论述题',
        questionType: 'essay',
        perScore: 10,
        answerCount: 2,
        questionIds: ['e1', 'e2', 'e3'],
        items: [toEssay('e1'), toEssay('e2'), toEssay('e3')],
      },
    ],
  }
  const submission = {
    id: 'rec000000000002',
    subjectCode: 'GD-15043',
    paperId: 'pap-sel',
    paperName: '选答模拟卷',
    userAnswers: { e1: '答1', e2: '答2', e3: '答3' },
    totalQuestions: 3,
    answeredCount: 3,
    objectiveTotal: 0,
    objectiveCorrect: 0,
    objectiveScore: 80,
    subjectiveScore: null,
    score: null,
    durationSeconds: 120,
    createdAt: '2026-11-25T10:00:00Z',
  }

  const pendingReport = buildSubmissionResult(paper, submission, '科目一')
  assert.deepEqual(
    pendingReport.questions.map((q) => q.status),
    ['pending', 'pending', 'pending'],
  )
  // 3 题全部自评为 mastered(10分/题) 或 partial/mastered，总分按最高 2 题封顶（20 分），不会加出 110 分
  const preview = estimateSubjectiveSelfGrade(pendingReport, {
    e1: 'partial',
    e2: 'mastered',
    e3: 'mastered',
  })
  assert.equal(preview.subjectiveScore, 20)
  assert.equal(preview.totalScore, 100)

  const gradedReport = buildSubmissionResult(
    paper,
    { ...submission, subjectiveScore: 20, score: 100 },
    '科目一',
  )
  assert.deepEqual(
    gradedReport.questions.map((q) => q.status),
    ['graded', 'graded', 'graded'],
  )
})
