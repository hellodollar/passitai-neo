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
const practiceConstants = await loadSource('constants/practice.ts')

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

test('双层评估快照 5+5 维度常量与接口字段完整透传', async () => {
  assert.deepEqual(
    practiceConstants.EVALUATION_MICRO_DIMENSIONS.map((item) => item.key),
    ['baseMastery', 'discrimination', 'examExecution', 'errorRecovery', 'subjectiveQuality'],
  )
  assert.deepEqual(
    practiceConstants.EVALUATION_MACRO_DIMENSIONS.map((item) => item.key),
    [
      'trainingDepth',
      'antiMemoReliability',
      'syllabusCoverage',
      'memoryStability',
      'passStructure',
    ],
  )

  responseData = {
    id: 'evl999999999999',
    subjectCode: 'GD-15043',
    triggerType: 'manual',
    estimatedScore: 68.5,
    objectiveEstimatedScore: 74,
    subjectiveEstimatedScore: 58,
    readinessLevel: 'building',
    confidence: 'medium',
    diagnosis: { summary: '需巩固薄弱考点', strengths: [], gaps: [] },
    recommendations: [],
    evidenceSnapshot: {
      practiceCount: 6,
      answeredQuestions: 120,
      objectiveAnswered: 100,
      objectiveCorrect: 76,
      subjectiveAnswered: 20,
      unresolvedMistakes: 8,
      highFrequencyCoverage: 0.72,
      rawScore: 76,
      credibility: 0.82,
      multiplier: 0.9,
      totalWater: 7.5,
      subjectivePassCapped: false,
      examBoost: {
        enabled: true,
        applied: true,
        points: 2.5,
        examAttemptedPapers: 3,
        firstAttemptQuestions: 80,
        examScore: 81,
        gapOverRaw: 5,
        reason: '整卷实战持续高于训练机械分',
      },
      micro: {
        dimensions: {
          baseMastery: 78,
          discrimination: 70,
          examExecution: 81,
          errorRecovery: null,
          subjectiveQuality: 60,
        },
        slotRawScores: { baseline: 78, pastExams: 81 },
      },
      macro: {
        dimensions: {
          trainingDepth: 80,
          antiMemoReliability: 75,
          syllabusCoverage: 72,
          memoryStability: 68,
          passStructure: 85,
        },
        waterAttribution: [
          {
            key: 'memoryStability',
            label: '记忆稳定性',
            score: 68,
            weight: 0.2,
            deduction: 3.5,
          },
        ],
      },
      examStabilityWarning: {
        triggered: true,
        examCount: 3,
        meanScore: 76,
        stdDev: 9.2,
        message: '近期整卷分数波动较大',
      },
      signals: {
        firstAttemptQuestions: 80,
        firstAttemptRate: 0.74,
        repeatAttemptQuestions: 40,
        repeatAttemptRate: 0.85,
        stubbornRepeatedMistakes: 2,
        examAttemptedPaperCount: 3,
      },
    },
    createdAt: '2026-11-26T12:00:00Z',
  }

  const evaluation = await evaluateSubject('GD-15043', { triggerType: 'manual' })
  assert.equal(evaluation.evidenceSnapshot.rawScore, 76)
  assert.equal(evaluation.evidenceSnapshot.totalWater, 7.5)
  assert.equal(evaluation.evidenceSnapshot.examBoost?.applied, true)
  assert.equal(evaluation.evidenceSnapshot.micro?.dimensions.errorRecovery, null)
  assert.equal(evaluation.evidenceSnapshot.macro?.waterAttribution[0].deduction, 3.5)
  assert.equal(evaluation.evidenceSnapshot.examStabilityWarning?.triggered, true)
})
