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

function readSection(body: unknown, key: string) {
  return body && typeof body === 'object' && !Array.isArray(body)
    ? ((body as Record<string, unknown>)[key] ?? {})
    : {}
}

function mockMe() {
  return {
    user: { ...mockUser, status: 'enabled' },
    preferences: {
      plan: {
        majorName: '人力资源管理',
        majorCode: '120206',
        subjects: [
          { name: '绩效管理', code: '13811-gd' },
          { name: '薪酬管理', code: '06091-gd' },
          { name: '劳动关系与劳动法', code: '13967-gd' },
        ],
      },
      practice: {
        autoNext: false,
        recordWrongQuestions: true,
        showExplanationAfterAnswer: true,
        loopAfterCompletion: false,
        autoSubmitAfterCompletion: false,
      },
      notifications: {
        dailyReminder: false,
        reminderTime: '',
        weeklyReport: false,
      },
    },
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
