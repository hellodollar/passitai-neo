// Generated from passitai-api/src/constants. Run pnpm sync:domain-values in passitai-api.
export const domainValues = {
  dataStatus: ['enabled', 'disabled'],
  sourceType: ['system', 'crawler', 'manual', 'import', 'ai'],
  userRole: ['admin', 'user'],
  educationLevel: ['本科', '专科'],
  examType: ['written', 'machine', 'practical'],
  examStatus: ['open', 'closed'],
  recordStatus: ['notStarted', 'inProgress', 'completed'],
  questionType: ['single', 'multiple', 'judge', 'nounExplain', 'shortAnswer', 'essay'],
  paperType: ['baseline', 'mock', 'pastExam', 'ai'],
  paperAssessmentPreset: ['overall', 'highFrequency', 'errorProne'],
  taskType: ['biguo_sync'],
  taskStatus: ['pending', 'running', 'completed', 'failed'],
  runnerType: ['biguo_sync'],
  runnerConnectionStatus: ['online', 'offline'],
  runnerWorkStatus: ['idle', 'busy'],
  runnerActivityStatus: ['idle', 'running', 'error'],
} as const

export const questionTypeLabels = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  nounExplain: '名词解释',
  shortAnswer: '简答题',
  essay: '论述题',
} as const satisfies Record<(typeof domainValues.questionType)[number], string>

export type DomainValue<K extends keyof typeof domainValues> = (typeof domainValues)[K][number]
