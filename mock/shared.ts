/**
 * 本地 mock 公共定义,与 docs/client-api.md 契约对齐。
 * 注意:vite.config.ts 默认代理真实后端(127.0.0.1:8787),
 * 需要纯前端开发时再注册 vite-plugin-mock-dev-server 启用。
 */

export const mockUser = {
  id: 'usr_a1b2c3d4e5f6',
  email: 'neo@passitai.ai',
  role: 'user' as const,
  createdAt: '2026-01-09T08:00:00.000Z',
}

export const mockSession = {
  token: 'mock-token-passitai',
  user: mockUser,
}

export const mockAccount = {
  email: 'neo@passitai.ai',
  password: 'abc12345',
  inviteCode: 'taikula',
}

/** ID 格式与后端 idSchema 一致:前缀 + 12 位 hex */
export const mockMajors = [
  { id: 'maj_34889595d67a', code: '120206', name: '人力资源管理', educationLevel: '本科', nextExamDate: '2026-10-25' },
  { id: 'maj_9d2f1b6a5c3e', code: '120201K', name: '工商管理', educationLevel: '本科', nextExamDate: '2026-10-25' },
  { id: 'maj_7b4a2e8c1d9f', code: '030101K', name: '法学', educationLevel: '本科', nextExamDate: '2026-10-25' },
]

export const mockSubjects = [
  { id: 'sub_9a3b7d5e2c86', code: '03709', name: '马克思主义基本原理概论', majorId: 'maj_34889595d67a' },
  { id: 'sub_7c4f2a9e3b15', code: '00054', name: '管理学原理', majorId: 'maj_34889595d67a' },
  { id: 'sub_2d8e6c1f9a40', code: '11466', name: '现代企业人力资源管理概论', majorId: 'maj_34889595d67a' },
  { id: 'sub_a1c3e5b7d9f2', code: '00067', name: '财务管理学', majorId: 'maj_9d2f1b6a5c3e' },
  { id: 'sub_b2d4f6a8c1e3', code: '00230', name: '合同法', majorId: 'maj_7b4a2e8c1d9f' },
]

export function buildMockPlan(majorId: string, subjectIds: string[]) {
  const major = mockMajors.find((item) => item.id === majorId)
  const subjects = mockSubjects
    .filter((item) => item.majorId === majorId && subjectIds.includes(item.id))
    .map(({ name, code }) => ({ name, code }))

  return {
    majorName: major?.name ?? '',
    majorCode: major?.code ?? '',
    educationLevel: major?.educationLevel ?? '本科',
    nextExamDate: major?.nextExamDate ?? null,
    subjects,
  }
}

/** 可变状态:被 /api/me、/api/plan、/api/practice/settings、/api/user/settings/notifications 共享 */
export const mockState = {
  plan: buildMockPlan('maj_34889595d67a', ['sub_9a3b7d5e2c86', 'sub_7c4f2a9e3b15']),
  practice: {
    autoNext: false,
    recordWrongQuestions: true,
    showExplanationAfterAnswer: true,
    loopAfterCompletion: false,
    autoSubmitAfterCompletion: false,
  },
  notifications: {
    dailyReminder: false,
    reminderTime: '20:00',
    weeklyReport: false,
  },
}

export function ok<T>(data: T, message = 'success') {
  return {
    code: 0,
    message,
    data,
  }
}

export function fail(code: number, message: string) {
  return {
    code,
    message,
    data: null,
  }
}

/** 后端业务码,与 passitai-api src/constants/status-code.ts 对齐 */
export const ApiCode = {
  BODY_INVALID: 1002,
  REQUEST_INVALID: 1000,
  AUTH_INVALID_CREDENTIALS: 2001,
  AUTH_ACCOUNT_EXISTS: 2003,
  INVITE_CODE_INVALID: 2005,
} as const
