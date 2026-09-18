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
