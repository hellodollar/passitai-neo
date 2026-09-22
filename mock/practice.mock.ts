import { defineMock } from 'vite-plugin-mock-dev-server'

import { ok } from './shared'

const mockMajors = [
  { id: 'major_001', code: '120201K', name: '工商管理' },
  { id: 'major_002', code: '120203K', name: '会计学' },
  { id: 'major_003', code: '080901', name: '计算机科学与技术' },
  { id: 'major_004', code: '050101', name: '汉语言文学' },
  { id: 'major_005', code: '030101K', name: '法学' },
  {
    id: 'major_006',
    code: '120206',
    name: '人力资源管理',
    educationLevel: '本科',
    nextExamDate: '2026-10-25T00:00:00+08:00',
  },
]

const mockSubjects = [
  { id: 'subj_001', code: '15043', name: '中国近现代史纲要' },
  { id: 'subj_002', code: '15044', name: '马克思主义基本原理' },
  { id: 'subj_003', code: '13000', name: '英语(二)' },
  { id: 'subj_004', code: '00054', name: '管理学原理' },
  { id: 'subj_005', code: '04184', name: '线性代数(经管类)' },
  { id: 'subj_006', code: '00159', name: '高级财务会计' },
  { id: 'subj_007', code: '02331', name: '数据结构' },
  { id: 'subj_008', code: '02326', name: '操作系统' },
  { id: 'subj_009', code: '00538', name: '中国古代文学史' },
  { id: 'subj_010', code: '05679', name: '宪法学' },
  { id: 'subj_011', code: '13811-gd', name: '绩效管理' },
  { id: 'subj_012', code: '06091-gd', name: '薪酬管理' },
  { id: 'subj_013', code: '13967-gd', name: '劳动关系与劳动法' },
  { id: 'subj_014', code: '14112-gd', name: '人员素质测评理论与方法' },
  { id: 'subj_015', code: '11466', name: '现代企业人力资源管理概论' },
]

function buildPlan(majorId: string, subjectIds: string[]) {
  const major = mockMajors.find((item) => item.id === majorId)
  const subjects = mockSubjects
    .filter((item) => subjectIds.includes(item.id))
    .map((item) => ({ name: item.name, code: item.code }))

  return {
    majorName: major?.name ?? '',
    majorCode: major?.code ?? '',
    educationLevel: major?.educationLevel,
    nextExamDate: major?.nextExamDate,
    subjects,
  }
}

let plan = buildPlan('major_006', ['subj_011', 'subj_012', 'subj_013'])

let practiceSettings = {
  autoNext: false,
  recordWrongQuestions: true,
  showExplanationAfterAnswer: true,
  loopAfterCompletion: false,
  autoSubmitAfterCompletion: false,
}

export default defineMock([
  {
    url: '/api/practice/plan',
    method: 'GET',
    delay: 100,
    body: ok(plan),
  },
  {
    url: '/api/practice/plan',
    method: 'PUT',
    delay: 100,
    body: ({ body }) => {
      const majorId = (body?.majorId as string) || 'major_006'
      const subjectIds = Array.isArray(body?.subjectIds) ? (body.subjectIds as string[]) : []
      plan = buildPlan(majorId, subjectIds)
      return ok(plan)
    },
  },
  {
    url: '/api/practice/entries',
    method: 'GET',
    delay: 100,
    body: ({ query = {} } = {}) => {
      const code = (query.code as string) || '00000'
      return ok([
        {
          type: 'practice',
          name: '专项训练',
          description: '速通核心考点，建立能力基准',
          questionCount: 120,
          answeredCount: 30,
          children: [
            { paperId: `paper_${code}_p1`, name: '考点通练', questionCount: 40, answeredCount: 12 },
            { paperId: `paper_${code}_p2`, name: '高频考点', questionCount: 40, answeredCount: 10 },
            { paperId: `paper_${code}_p3`, name: '易错强化', questionCount: 40, answeredCount: 8 },
          ],
        },
        {
          type: 'pastExam',
          name: '历年真题',
          description: '直刷历年真题，熟悉真实考情',
          questionCount: 90,
          answeredCount: 20,
          children: [
            {
              paperId: `paper_${code}_e1`,
              name: '2024年真题',
              questionCount: 30,
              answeredCount: 10,
            },
            {
              paperId: `paper_${code}_e2`,
              name: '2023年真题',
              questionCount: 30,
              answeredCount: 6,
            },
            {
              paperId: `paper_${code}_e3`,
              name: '2022年真题',
              questionCount: 30,
              answeredCount: 4,
            },
          ],
        },
        {
          type: 'mock',
          name: '考前模拟',
          description: '模拟考场，检验水平',
          questionCount: 60,
          answeredCount: 0,
          children: [
            { paperId: `paper_${code}_m1`, name: '模拟卷一', questionCount: 30, answeredCount: 0 },
            { paperId: `paper_${code}_m2`, name: '模拟卷二', questionCount: 30, answeredCount: 0 },
          ],
        },
        {
          type: 'ai',
          name: 'AI训练',
          description: '边刷边懂你，动态调整训练',
          questionCount: 0,
          answeredCount: 0,
        },
      ])
    },
  },
  {
    url: '/api/practice/answer-sheet',
    method: 'GET',
    delay: 100,
    body: () =>
      ok({
        paperName: '2025年4月真题',
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
                userAnswer: 'A',
                explanation: '由矩阵秩的定义，A 存在一个 r 阶子式不为零，可得 r(A) ≥ r，选 B。',
              },
            ],
          },
          {
            type: 'multiple',
            label: '多选题',
            items: [
              {
                id: 'qst_1517a98908c0',
                title: '古典管理理论主要是由以下哪几个学派构成的？（　）',
                questionType: 'multiple',
                A: '科学管理理论',
                B: '一般管理理论',
                C: '行政组织理论',
                D: '行为科学理论',
                E: '决策理论',
                F: null,
                correctAnswer: 'A,B,C',
                userAnswer: 'A,B',
                explanation:
                  '古典管理理论阶段，主要由泰勒的科学管理理论、法约尔的一般管理理论和韦伯的行政组织理论构成。',
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
    body: ({ query = {} } = {}) =>
      ok({
        submissionId: String(query.submissionId ?? 'submission_preview'),
        paperId: String(query.paperId ?? ''),
        paperName: '2025年4月真题',
        subjectName: '马克思主义基本原理',
        score: 50,
        totalCount: 4,
        answeredCount: 3,
        correctCount: 2,
        wrongCount: 1,
        unansweredCount: 1,
        accuracy: 50,
        elapsedSeconds: 386,
        submittedAt: new Date().toISOString(),
        placeholder: true,
        questions: [
          {
            id: 'result_q1',
            index: 1,
            title: '若矩阵 A 中有一个 r 阶子式不为零，则矩阵 A 的秩满足',
            questionType: 'single',
            userAnswer: 'A',
            correctAnswer: 'B',
            explanation: '由矩阵秩的定义，可得矩阵 A 的秩至少为 r。',
            status: 'wrong',
          },
          {
            id: 'result_q2',
            index: 2,
            title: '古典管理理论的代表学派包括哪些？',
            questionType: 'multiple',
            userAnswer: 'A、B、C',
            correctAnswer: 'A、B、C',
            explanation: '包括科学管理、一般管理和行政组织理论。',
            status: 'correct',
          },
          {
            id: 'result_q3',
            index: 3,
            title: '组织结构设计需要考虑环境与战略的匹配。',
            questionType: 'judge',
            userAnswer: '正确',
            correctAnswer: '正确',
            explanation: '组织结构需要与战略、规模和外部环境保持匹配。',
            status: 'correct',
          },
          {
            id: 'result_q4',
            index: 4,
            title: '简述绩效反馈的主要作用。',
            questionType: 'shortAnswer',
            userAnswer: '',
            correctAnswer: '促进改进、明确目标并支持员工发展。',
            explanation: '绩效反馈连接评价结果与后续改进，是绩效管理闭环的重要环节。',
            status: 'unanswered',
          },
        ],
      }),
  },
  {
    url: '/api/practice/settings',
    method: 'GET',
    delay: 100,
    body: ok(practiceSettings),
  },
  {
    url: '/api/practice/settings',
    method: 'PATCH',
    delay: 100,
    body: ({ body }) => {
      practiceSettings = { ...practiceSettings, ...body }
      return ok(practiceSettings)
    },
  },
  {
    url: '/api/wrong-questions',
    method: 'GET',
    delay: 100,
    body: ok({ total: 0, items: [] }),
  },
  {
    url: '/api/favorites',
    method: 'GET',
    delay: 100,
    body: ok({ total: 0, items: [] }),
  },
  {
    url: '/api/answer-sheets',
    method: 'GET',
    delay: 100,
    body: ok({ total: 0, items: [] }),
  },
])
