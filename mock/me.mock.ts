import { defineMock } from 'vite-plugin-mock-dev-server'

import { mockUser, ok } from './shared'

const mockProfile = {
  ...mockUser,
  displayName: 'Neo',
  avatarUrl: '',
  bio: '',
  examGoal: '2026年10月自考',
  placeholder: true,
  persisted: false,
}

const mockPreferences = {
  userId: mockUser.id,
  placeholder: true,
  persisted: false,
  study: {
    dailyGoal: 20,
    defaultMode: 'paper',
    questionOrder: 'paper',
    autoNext: false,
    showAnswerAfterSubmit: true,
    majorId: 'major_001',
    subjectIds: ['subj_001', 'subj_002'],
    subjectOrder: ['subj_001', 'subj_002'],
    hiddenSubjectIds: [],
  },
  notifications: {
    dailyReminder: false,
    reminderTime: '',
    weeklyReport: false,
  },
  display: {
    theme: 'system',
    compactMode: false,
  },
}

const mockSettings = {
  userId: mockUser.id,
  placeholder: true,
  persisted: false,
  practice: {
    dailyGoal: 20,
    questionOrder: 'paper',
    autoNext: false,
    showAnswerAfterSubmit: true,
  },
  account: {
    emailChangeEnabled: false,
    passwordChangeEnabled: false,
  },
  privacy: {
    profileVisibility: 'private',
    showLearningStats: false,
  },
  security: {
    activeSessions: [],
  },
}

const mockCatalog = {
  majors: [
    { id: 'major_001', name: '工商管理' },
    { id: 'major_002', name: '会计学' },
    { id: 'major_003', name: '计算机科学与技术' },
    { id: 'major_004', name: '汉语言文学' },
    { id: 'major_005', name: '法学' },
    { id: 'major_006', name: '人力资源管理' },
  ],
  subjects: [
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
    { id: 'subj_011', name: '人力资源管理(一)', majorId: 'major_006', majorName: '人力资源管理' },
    { id: 'subj_012', name: '劳动经济学', majorId: 'major_006', majorName: '人力资源管理' },
  ],
}

function readSection(body: unknown, key: string) {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? ((body as Record<string, unknown>)[key] ?? {})
    : {}
}

function mockMe() {
  return {
    user: mockUser,
    profile: mockProfile,
    preferences: mockPreferences,
    settings: mockSettings,
    catalog: mockCatalog,
    editable: {
      profile: {
        method: 'PATCH',
        path: '/api/profile',
        fields: ['displayName', 'avatarUrl', 'bio', 'examGoal'],
      },
      preferences: {
        method: 'PATCH',
        path: '/api/preferences',
        fields: ['study', 'notifications', 'display'],
      },
      settings: {
        method: 'PATCH',
        path: '/api/settings',
        fields: ['account', 'privacy', 'security'],
      },
    },
    placeholder: true,
  }
}

export default defineMock([
  {
    url: '/api/me',
    method: 'GET',
    delay: 100,
    body: ok(mockMe()),
  },
  {
    url: '/api/profile',
    method: 'PATCH',
    delay: 80,
    body: ({ body }) => {
      Object.assign(mockProfile, body ?? {})
      return ok(mockProfile)
    },
  },
  {
    url: '/api/preferences',
    method: 'PATCH',
    delay: 80,
    body: ({ body }) => {
      Object.assign(mockPreferences.study, readSection(body, 'study'))
      Object.assign(mockPreferences.notifications, readSection(body, 'notifications'))
      Object.assign(mockPreferences.display, readSection(body, 'display'))
      return ok(mockPreferences)
    },
  },
  {
    url: '/api/settings',
    method: 'GET',
    delay: 80,
    body: ok(mockSettings),
  },
  {
    url: '/api/settings',
    method: 'PATCH',
    delay: 80,
    body: ({ body }) => {
      Object.assign(mockSettings.practice, readSection(body, 'practice'))
      Object.assign(mockSettings.account, readSection(body, 'account'))
      Object.assign(mockSettings.privacy, readSection(body, 'privacy'))
      Object.assign(mockSettings.security, readSection(body, 'security'))
      return ok(mockSettings)
    },
  },
  {
    url: '/api/settings/practice',
    method: 'PATCH',
    delay: 80,
    body: ({ body }) => {
      Object.assign(mockSettings.practice, body ?? {})
      return ok(mockSettings)
    },
  },
])
