import { defineMock } from 'vite-plugin-mock-dev-server'

import { ok } from './shared'

const mockMajors = [
  { id: 'major_001', name: '工商管理' },
  { id: 'major_002', name: '会计学' },
  { id: 'major_003', name: '计算机科学与技术' },
  { id: 'major_004', name: '汉语言文学' },
  { id: 'major_005', name: '法学' },
  { id: 'major_006', name: '人力资源管理' },
]

const mockSubjects = [
  { id: 'subj_001', name: '中国近现代史纲要', majorId: 'major_001', majorName: '工商管理' },
  { id: 'subj_002', name: '马克思主义基本原理', majorId: 'major_001', majorName: '工商管理' },
  { id: 'subj_003', name: '英语(二)', majorId: 'major_001', majorName: '工商管理' },
  { id: 'subj_004', name: '管理学原理', majorId: 'major_001', majorName: '工商管理' },
  { id: 'subj_005', name: '线性代数(经管类)', majorId: 'major_002', majorName: '会计学' },
  { id: 'subj_006', name: '高级财务会计', majorId: 'major_002', majorName: '会计学' },
  { id: 'subj_007', name: '数据结构', majorId: 'major_003', majorName: '计算机科学与技术' },
  { id: 'subj_008', name: '操作系统', majorId: 'major_003', majorName: '计算机科学与技术' },
  { id: 'subj_009', name: '中国古代文学史', majorId: 'major_004', majorName: '汉语言文学' },
  { id: 'subj_010', name: '宪法学', majorId: 'major_005', majorName: '法学' },
  { id: 'subj_011', name: '绩效管理', majorId: 'major_006', majorName: '人力资源管理' },
  { id: 'subj_012', name: '薪酬管理', majorId: 'major_006', majorName: '人力资源管理' },
  { id: 'subj_013', name: '劳动关系与劳动法', majorId: 'major_006', majorName: '人力资源管理' },
  { id: 'subj_014', name: '人员素质测评理论与方法', majorId: 'major_006', majorName: '人力资源管理' },
  { id: 'subj_015', name: '现代企业人力资源管理概论', majorId: 'major_006', majorName: '人力资源管理' },
]

const mockMajorOptions = [
  { id: 'major_001', code: '120201K', name: '工商管理' },
  { id: 'major_002', code: '120203K', name: '会计学' },
  { id: 'major_003', code: '080901', name: '计算机科学与技术' },
  { id: 'major_004', code: '050101', name: '汉语言文学' },
  { id: 'major_005', code: '030101K', name: '法学' },
  { id: 'major_006', code: '120206', name: '人力资源管理' },
]

const mockSubjectOptions = [
  { id: 'subj_001', code: '15043', name: '中国近现代史纲要', majorId: 'major_001' },
  { id: 'subj_002', code: '15044', name: '马克思主义基本原理', majorId: 'major_001' },
  { id: 'subj_003', code: '13000', name: '英语(二)', majorId: 'major_001' },
  { id: 'subj_004', code: '00054', name: '管理学原理', majorId: 'major_001' },
  { id: 'subj_005', code: '04184', name: '线性代数(经管类)', majorId: 'major_002' },
  { id: 'subj_006', code: '00159', name: '高级财务会计', majorId: 'major_002' },
  { id: 'subj_007', code: '02331', name: '数据结构', majorId: 'major_003' },
  { id: 'subj_008', code: '02326', name: '操作系统', majorId: 'major_003' },
  { id: 'subj_009', code: '00538', name: '中国古代文学史', majorId: 'major_004' },
  { id: 'subj_010', code: '05679', name: '宪法学', majorId: 'major_005' },
  { id: 'subj_011', code: '13811-gd', name: '绩效管理', majorId: 'major_006' },
  { id: 'subj_012', code: '06091-gd', name: '薪酬管理', majorId: 'major_006' },
  { id: 'subj_013', code: '13967-gd', name: '劳动关系与劳动法', majorId: 'major_006' },
  { id: 'subj_014', code: '14112-gd', name: '人员素质测评理论与方法', majorId: 'major_006' },
  { id: 'subj_015', code: '11466', name: '现代企业人力资源管理概论', majorId: 'major_006' },
]

function filterOptions(
  options: Array<{ id: string; code: string; name: string; majorId?: string }>,
  query: Record<string, unknown>,
) {
  const singleId = query.id as string | undefined
  const singleCode = query.code as string | undefined
  const majorId = query.majorId as string | undefined
  const ids = typeof query.ids === 'string' ? query.ids.split(',').filter(Boolean) : []
  const codes = typeof query.codes === 'string' ? query.codes.split(',').filter(Boolean) : []

  return options
    .filter((option) => {
      if (singleId) return option.id === singleId
      if (singleCode) return option.code === singleCode
      if (ids.length > 0) return ids.includes(option.id)
      if (codes.length > 0) return codes.includes(option.code)
      return true
    })
    .filter((option) => (majorId ? option.majorId === majorId : true))
    .map(({ id, code, name }) => ({ id, code, name }))
}

export default defineMock([
  {
    url: '/api/majors',
    method: 'GET',
    delay: 100,
    body: ok(mockMajors),
  },
  {
    url: '/api/subjects',
    method: 'GET',
    delay: 100,
    body: ({ query = {} } = {}) => {
      const majorId = query.majorId as string | undefined
      const filtered = majorId
        ? mockSubjects.filter((s) => s.majorId === majorId)
        : mockSubjects
      return ok(filtered)
    },
  },
  {
    url: '/api/options/majors',
    method: 'GET',
    delay: 100,
    body: ({ query = {} } = {}) => ok(filterOptions(mockMajorOptions, query)),
  },
  {
    url: '/api/options/subjects',
    method: 'GET',
    delay: 100,
    body: ({ query = {} } = {}) => ok(filterOptions(mockSubjectOptions, query)),
  },
])
