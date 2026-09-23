import { defineMock } from 'vite-plugin-mock-dev-server'

import { buildMockPlan, mockMajors, mockState, mockSubjects, ok } from './shared'

type MockFavorite = {
  id: string
  userId: string
  questionId: string
  subjectId: string
  paperId: string
  createdAt: string
  updatedAt: string | null
  deletedAt: null
}

const mockFavorites = new Map<string, MockFavorite>()
const mockWrongQuestions = new Map<string, MockFavorite>()

export default defineMock([
  // ── 学习计划:契约路径 /api/plan ──
  {
    url: '/api/plan',
    method: 'GET',
    delay: 100,
    body: ok(mockState.plan),
  },

  {
    url: '/api/plan',
    method: 'PUT',
    delay: 100,
    body: ({ body }) => {
      const majorId = String(body?.majorId ?? '')
      const subjectIds = Array.isArray(body?.subjectIds) ? (body.subjectIds as string[]) : []
      if (!majorId || !mockMajors.some((item) => item.id === majorId)) {
        return { code: 4001, message: '资源不存在', data: null }
      }
      mockState.plan = buildMockPlan(majorId, subjectIds)
      return ok(mockState.plan)
    },
  },

  // ── 练习设置 ──
  {
    url: '/api/practice/settings',
    method: 'GET',
    delay: 100,
    body: ok(mockState.practice),
  },

  {
    url: '/api/practice/settings',
    method: 'PATCH',
    delay: 100,
    body: ({ body }) => {
      Object.assign(mockState.practice, body ?? {})
      return ok(mockState.practice)
    },
  },

  // ── 练习入口:参数 subjectId ──
  {
    url: '/api/practice/entries',
    method: 'GET',
    delay: 100,
    body: () =>
      ok([
        {
          type: 'practice',
          name: '专项训练',
          description: '速通核心考点，建立能力基准',
          questionCount: 120,
          answeredCount: 30,
          children: [
            { paperId: 'pap_a1b2c3d4e5f6', name: '考点通练', questionCount: 40, answeredCount: 12 },
            { paperId: 'pap_b2c3d4e5f6a7', name: '高频考点', questionCount: 40, answeredCount: 10 },
            { paperId: 'pap_c3d4e5f6a7b8', name: '易错强化', questionCount: 40, answeredCount: 8 },
          ],
        },
        {
          type: 'pastExam',
          name: '历年真题',
          description: '直刷历年真题，熟悉真实考情',
          questionCount: 90,
          answeredCount: 20,
          children: [
            { paperId: 'pap_d4e5f6a7b8c9', name: '2025年4月真题', questionCount: 90, answeredCount: 20 },
          ],
        },
        {
          type: 'mock',
          name: '考前模拟',
          description: '模拟考场，检验水平',
          questionCount: 60,
          answeredCount: 0,
          children: [{ paperId: 'pap_e5f6a7b8c9d0', name: '模拟卷一', questionCount: 60, answeredCount: 0 }],
        },
        {
          type: 'ai',
          name: 'AI训练',
          description: '边刷边懂你，动态调整训练',
          questionCount: 0,
          answeredCount: 0,
        },
      ]),
  },

  // ── 题目详情 / 提交 / 结果:文档占位阶段,前端练习流程依赖 ──
  {
    url: '/api/practice/answer-sheet',
    method: 'GET',
    delay: 100,
    body: ({ query }) =>
      ok({
        paperId: String(query?.paperId ?? ''),
        subjectId: mockSubjects[0]!.id,
        paperName: '考点通练',
        recordStatus: 'inProgress',
        score: 0,
        questionGroups: [
          {
            type: 'single',
            label: '单选题',
            items: [
              {
                id: 'qst_80310cb2cff5',
                title: '若矩阵A中有一个r+1阶子式等于零，且所有r阶子式都不为零，则必有',
                questionType: 'single',
                A: 'r(A)=r',
                B: 'r(A) ≥r',
                C: 'r(A)< r',
                D: 'r(A)=r+1',
                E: null,
                F: null,
                correctAnswer: 'B',
                userAnswer: null,
                explanation: '由矩阵秩的定义，A 存在一个 r 阶子式不为零，可得 r(A) ≥ r，选 B。',
              },
            ],
          },
        ],
      }),
  },

  {
    url: '/api/practice/submit',
    method: 'POST',
    delay: 350,
    body: ({ body }) =>
      ok({
        id: `submission_${Date.now()}`,
        paperId: String(body?.paperId ?? ''),
        status: 'submitted',
        submittedAt: new Date().toISOString(),
        placeholder: true,
      }),
  },

  {
    url: '/api/practice/result',
    method: 'GET',
    delay: 180,
    body: ({ query }) =>
      ok({
        submissionId: String(query?.submissionId ?? 'submission_preview'),
        paperId: String(query?.paperId ?? ''),
        paperName: '考点通练',
        subjectName: '马克思主义基本原理概论',
        score: 50,
        totalCount: 2,
        answeredCount: 2,
        correctCount: 1,
        wrongCount: 1,
        unansweredCount: 0,
        accuracy: 50,
        elapsedSeconds: 386,
        submittedAt: new Date().toISOString(),
        placeholder: true,
        questions: [
          {
            id: 'qst_80310cb2cff5',
            index: 1,
            title: '若矩阵A中有一个r+1阶子式等于零，且所有r阶子式都不为零，则必有',
            questionType: 'single',
            userAnswer: 'A',
            correctAnswer: 'B',
            explanation: '由矩阵秩的定义，可得 r(A) ≥ r。',
            status: 'wrong',
          },
        ],
      }),
  },

  // ── 收藏 / 错题:契约路径 /:questionId ──
  {
    url: '/api/favorites',
    method: 'GET',
    delay: 100,
    body: () => ok({ total: mockFavorites.size, items: [...mockFavorites.values()] }),
  },

  {
    url: '/api/favorites/:questionId',
    method: 'PUT',
    delay: 100,
    body: ({ body, params }) => {
      const questionId = String(params.questionId ?? '')
      const existing = mockFavorites.get(questionId)
      const now = new Date().toISOString()
      const favorite: MockFavorite = {
        id: existing?.id ?? `fav_${questionId.slice(-12)}`,
        userId: 'usr_a1b2c3d4e5f6',
        questionId,
        subjectId: mockSubjects[0]!.id,
        paperId: String(body?.paperId ?? ''),
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing ? now : null,
        deletedAt: null,
      }
      mockFavorites.set(questionId, favorite)
      return ok(favorite)
    },
  },

  {
    url: '/api/favorites/:questionId',
    method: 'DELETE',
    delay: 100,
    body: ({ params }) => {
      mockFavorites.delete(String(params.questionId ?? ''))
      return ok(null)
    },
  },

  {
    url: '/api/wrong-questions',
    method: 'GET',
    delay: 100,
    body: () => ok({ total: mockWrongQuestions.size, items: [...mockWrongQuestions.values()] }),
  },

  {
    url: '/api/wrong-questions/:questionId',
    method: 'PUT',
    delay: 100,
    body: ({ body, params }) => {
      const questionId = String(params.questionId ?? '')
      const existing = mockWrongQuestions.get(questionId)
      const now = new Date().toISOString()
      const wrongQuestion: MockFavorite = {
        id: existing?.id ?? `wrq_${questionId.slice(-12)}`,
        userId: 'usr_a1b2c3d4e5f6',
        questionId,
        subjectId: mockSubjects[0]!.id,
        paperId: String(body?.paperId ?? ''),
        createdAt: existing?.createdAt ?? now,
        updatedAt: existing ? now : null,
        deletedAt: null,
      }
      mockWrongQuestions.set(questionId, wrongQuestion)
      return ok(wrongQuestion)
    },
  },

  {
    url: '/api/wrong-questions/:questionId',
    method: 'DELETE',
    delay: 100,
    body: ({ params }) => {
      mockWrongQuestions.delete(String(params.questionId ?? ''))
      return ok(null)
    },
  },
])
