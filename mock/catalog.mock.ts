import { defineMock } from 'vite-plugin-mock-dev-server'

import { ok } from './shared'

const mockMajors = [
  { id: 'major_001', name: '工商管理' },
  { id: 'major_002', name: '会计学' },
  { id: 'major_003', name: '计算机科学与技术' },
  { id: 'major_004', name: '汉语言文学' },
  { id: 'major_005', name: '法学' },
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
]

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
])
