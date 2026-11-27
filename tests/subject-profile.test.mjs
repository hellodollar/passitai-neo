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

test('领域常量生成文件已切换为 practice-resource-values 且移除已废弃常量', () => {
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
  assert.equal('aiEnhanceModes' in resourceValues, false)
  assert.equal('EVALUATION_MICRO_DIMENSIONS' in practiceConstants, false)
  assert.equal('EVALUATION_MACRO_DIMENSIONS' in practiceConstants, false)
})

test('个人科目画像、规则评估、历史分页与 AI 补强卷接口路径与协议对齐', async () => {
  const controller = new AbortController()
  responseData = {
    id: 'usp1234567890ab',
    subjectCode: 'GD-15043',
    pointStats: {
      绩效指标设计: { attempted: 6, correct: 3, wrongCount: 4, mistakeCount: 2, mastery: 0.5 },
    },
    questionTypeStats: {
      multiple: {
        attempted: 10,
        correct: 5,
        wrongCount: 6,
        unresolvedMistakes: 3,
        avgScoreRate: 0.5,
      },
    },
    trainingProgress: {
      baseline: {
        weight: 0.4,
        completedPapers: 1,
        totalPapers: 1,
        avgScore: 82,
        score: 82,
        level: 'familiar',
        met: false,
        papers: [
          {
            paperId: 'pap001',
            paperName: '基准卷',
            paperType: 'pointCoverage',
            paperMode: 'bank',
            totalQuestions: 20,
            coveredQuestions: 20,
            completedRounds: 1,
            currentRoundCoverage: 0,
            rawScore: 82,
            level: 'familiar',
            lastPracticedAt: '2026-11-27T10:00:00Z',
          },
        ],
      },
    },
  }
  const profile = await fetchSubjectProfile('GD-15043', controller.signal)
  assert.equal(profile.id, 'usp1234567890ab')
  assert.equal(profile.pointStats['绩效指标设计'].wrongCount, 4)
  assert.equal(profile.questionTypeStats.multiple.unresolvedMistakes, 3)
  assert.equal(profile.trainingProgress.baseline.papers[0].lastPracticedAt, '2026-11-27T10:00:00Z')
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

  responseData = {
    id: 'pap1234567890ab',
    enhanceType: 'pointWeak',
    sourceType: 'ai',
    targetPointKeys: ['p1'],
    targetQuestionTypes: ['multiple', 'shortAnswer'],
  }
  const generated = await generateAiEnhancePaper('GD-15043', {
    enhanceType: 'pointWeak',
    pointKeys: ['p1'],
    questionTypes: ['multiple', 'shortAnswer'],
  })
  assert.equal(generated.id, 'pap1234567890ab')
  assert.deepEqual(generated.targetQuestionTypes, ['multiple', 'shortAnswer'])
  assert.equal(calls[3].pathname, '/api/subjects/GD-15043/ai-enhance/generate')
  assert.equal(calls[3].method, 'POST')
  assert.deepEqual(calls[3].body, {
    enhanceType: 'pointWeak',
    pointKeys: ['p1'],
    questionTypes: ['multiple', 'shortAnswer'],
  })

  responseData = null
  await deleteAiEnhancePaper('GD-15043', 'pap1234567890ab')
  assert.equal(calls[4].pathname, '/api/subjects/GD-15043/ai-enhance/papers/pap1234567890ab')
  assert.equal(calls[4].method, 'DELETE')
})

test('Quick Score 评估快照与错题特征画像字段完整透传', async () => {
  responseData = {
    id: 'evl999999999999',
    subjectCode: 'GD-15043',
    triggerType: 'manual',
    estimatedScore: 68.5,
    objectiveEstimatedScore: 74,
    subjectiveEstimatedScore: 58,
    readinessLevel: 'building',
    confidence: 'medium',
    diagnosis: {
      summary: '多选题与超期考点仍需巩固',
      strengths: [{ code: 'baseline_good', title: '基础题表现稳定', detail: '单选与判断掌握较好' }],
      gaps: [
        {
          code: 'question_type_weak',
          title: '多选题丢分偏高',
          severity: 'high',
          current: '得分率 52%',
          target: '≥ 75%',
        },
        {
          code: 'review_overdue',
          title: '部分考点超期未复习',
          severity: 'medium',
          current: '3 个考点超 14 天未练',
          target: '近 14 天内复盘',
          pointKeys: ['绩效指标设计'],
        },
      ],
    },
    recommendations: [
      {
        gapCode: 'question_type_weak',
        actionType: 'aiGenerate',
        priority: 1,
        title: '专攻多选题与薄弱考点',
        reason: '定向补强高频失分题型',
        enhanceType: 'pointWeak',
        pointKeys: ['绩效指标设计'],
        questionTypes: ['multiple'],
      },
    ],
    evidenceSnapshot: {
      practiceCount: 6,
      answeredQuestions: 120,
      objectiveAnswered: 100,
      objectiveCorrect: 76,
      subjectiveAnswered: 20,
      unresolvedMistakes: 8,
      highFrequencyCoverage: 0.72,
      masteryLevel: 'familiar',
      slotScores: { baseline: 80, pastExams: 72, mockExams: 68, aiEnhance: 60 },
      slotLevels: {
        baseline: 'familiar',
        pastExams: 'familiar',
        mockExams: 'aware',
        aiEnhance: 'aware',
      },
      rawScore: 76.1,
      memoryRetention: 0.9,
      subjectivePassCapped: false,
      quickScore: {
        baseline: 80,
        pastExams: 72,
        mockExams: 68,
        aiEnhance: 60,
        paperStructure: 74,
        objectiveRate: 0.76,
        subjectiveRate: 0.58,
      },
      weaknessProfile: {
        weakPointKeys: ['绩效指标设计'],
        stalePointKeys: ['目标管理'],
        weakQuestionTypes: ['multiple', 'shortAnswer'],
        stubbornMistakeCount: 2,
        confusionMistakeCount: 1,
      },
    },
    createdAt: '2026-11-27T12:00:00Z',
  }

  const evaluation = await evaluateSubject('GD-15043', { triggerType: 'manual' })
  assert.equal(evaluation.evidenceSnapshot.rawScore, 76.1)
  assert.equal(evaluation.evidenceSnapshot.memoryRetention, 0.9)
  assert.equal(evaluation.evidenceSnapshot.quickScore?.paperStructure, 74)
  assert.equal(evaluation.evidenceSnapshot.quickScore?.objectiveRate, 0.76)
  assert.deepEqual(evaluation.evidenceSnapshot.weaknessProfile?.weakQuestionTypes, [
    'multiple',
    'shortAnswer',
  ])
  assert.equal(evaluation.evidenceSnapshot.weaknessProfile?.stubbornMistakeCount, 2)
  assert.deepEqual(evaluation.recommendations[0].questionTypes, ['multiple'])
  assert.equal(evaluation.diagnosis.gaps[0].code, 'question_type_weak')
  assert.equal(evaluation.diagnosis.gaps[1].code, 'review_overdue')
})
