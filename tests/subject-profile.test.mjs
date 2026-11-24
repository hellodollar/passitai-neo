import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const {
  fetchSubjectProfile,
  evaluateSubject,
  fetchSubjectEvaluations,
  generateAiEnhancePaper,
  deleteAiEnhancePaper,
} = await loadSource('api/subject-profile.ts')
const resourceValues = await loadSource('generated/practice-resource-values.ts')

const previousFetch = globalThis.fetch
let calls = []
let responseData = null

beforeEach(() => {
  calls = []
  responseData = null
  globalThis.fetch = async (url, init = {}) => {
    const target = new URL(String(url), 'https://fixture.invalid')
    calls.push({
      pathname: target.pathname,
      search: target.search,
      method: init.method ?? 'GET',
      body: init.body ? JSON.parse(String(init.body)) : undefined,
      signal: init.signal,
    })
    return new Response(JSON.stringify({ ok: true, data: responseData }), {
      headers: { 'content-type': 'application/json' },
    })
  }
})

afterEach(() => {
  globalThis.fetch = previousFetch
})

test('领域常量生成文件已切换为 practice-resource-values 且删除旧文件', () => {
  assert.equal(
    existsSync(new URL('../src/generated/practice-template-values.ts', import.meta.url)),
    false,
  )
  assert.deepEqual(resourceValues.practiceResourceTypes, [
    'baseline',
    'mockExams',
    'pastExams',
    'aiEnhance',
  ])
  assert.deepEqual(resourceValues.trainingMasteryLevels, ['weak', 'aware', 'familiar', 'mastered'])
  assert.equal(resourceValues.trainingMasteryLabels.mastered, '掌握')
  assert.equal(resourceValues.aiEnhanceLabels.pointWeak, '考点薄弱补强')
  assert.deepEqual(resourceValues.aiEnhanceModes, ['pending_fix', 'verified_fixed', 'suspected_ok'])
})

test('个人科目画像、规则评估、历史分页与 AI 补强卷接口路径与协议对齐', async () => {
  const controller = new AbortController()
  responseData = { id: 'usp1234567890ab', subjectCode: 'GD-15043' }
  const profile = await fetchSubjectProfile('GD-15043', controller.signal)
  assert.equal(profile.id, 'usp1234567890ab')
  assert.equal(calls[0].pathname, '/api/subjects/GD-15043/profile')
  assert.equal(calls[0].method, 'GET')
  assert.equal(calls[0].signal, controller.signal)

  responseData = { id: 'evl1234567890ab', estimatedScore: 76 }
  const evaluation = await evaluateSubject('GD-15043', { triggerType: 'practice' })
  assert.equal(evaluation.estimatedScore, 76)
  assert.equal(calls[1].pathname, '/api/subjects/GD-15043/evaluate')
  assert.equal(calls[1].method, 'POST')
  assert.deepEqual(calls[1].body, { triggerType: 'practice' })

  responseData = { total: 1, items: [evaluation] }
  const history = await fetchSubjectEvaluations('GD-15043', { page: 2, limit: 10 })
  assert.equal(history.total, 1)
  assert.equal(calls[2].pathname, '/api/subjects/GD-15043/evaluations')
  assert.equal(calls[2].search, '?page=2&limit=10')

  responseData = { id: 'pap1234567890ab', enhanceType: 'pointWeak', sourceType: 'ai' }
  const generated = await generateAiEnhancePaper('GD-15043', {
    enhanceType: 'pointWeak',
    pointKeys: ['p1'],
  })
  assert.equal(generated.id, 'pap1234567890ab')
  assert.equal(calls[3].pathname, '/api/subjects/GD-15043/ai-enhance/generate')
  assert.equal(calls[3].method, 'POST')
  assert.deepEqual(calls[3].body, { enhanceType: 'pointWeak', pointKeys: ['p1'] })

  responseData = null
  await deleteAiEnhancePaper('GD-15043', 'pap1234567890ab')
  assert.equal(calls[4].pathname, '/api/subjects/GD-15043/ai-enhance/papers/pap1234567890ab')
  assert.equal(calls[4].method, 'DELETE')
})
