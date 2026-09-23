// Generated from banana-api/src/constants. Run pnpm sync:domain-values in banana-api.
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

export type DomainValue<K extends keyof typeof domainValues> = (typeof domainValues)[K][number]
