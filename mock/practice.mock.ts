import { defineMock } from 'vite-plugin-mock-dev-server'

import { ok } from './shared'

const mockMajors = [
  { id: 'major_001', code: '120201K', name: '工商管理' },
  { id: 'major_002', code: '120203K', name: '会计学' },
  { id: 'major_003', code: '080901', name: '计算机科学与技术' },
  { id: 'major_004', code: '050101', name: '汉语言文学' },
  { id: 'major_005', code: '030101K', name: '法学' },
  { id: 'major_006', code: '120206', name: '人力资源管理' },
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
    subjects,
  }
}

let plan = buildPlan('major_006', ['subj_011', 'subj_012', 'subj_013'])

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
