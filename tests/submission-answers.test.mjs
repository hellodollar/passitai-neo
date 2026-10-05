import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { toSubmissionAnswers } = await loadSource('utils/submission-answers.ts')

test('交卷数据按题型转换，并排除不属于当前题集的旧答案', () => {
  const questions = [
    { id: 'single', questionType: 'single' },
    { id: 'multiple', questionType: 'multiple' },
    { id: 'essay', questionType: 'essay' },
  ]
  const records = {
    single: { questionId: 'single', text: 'A', values: ['A'] },
    multiple: { questionId: 'multiple', text: 'A、C', values: ['A', 'C'] },
    essay: { questionId: 'essay', text: '我的论述', values: [] },
    stale: { questionId: 'stale', text: '旧题答案', values: [] },
  }

  assert.deepEqual(toSubmissionAnswers(records, questions), {
    single: 'A',
    multiple: ['A', 'C'],
    essay: '我的论述',
  })
})
