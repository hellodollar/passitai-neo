// Generated from passitai-api/src/shared/constants/practice-resource.ts.
export const practiceResourceTypes = ["baseline","mockExams","pastExams","aiEnhance"] as const
export type PracticeResourceType = (typeof practiceResourceTypes)[number]
export const trainingMasteryLevels = ["weak","aware","familiar","mastered"] as const
export type TrainingMasteryLevel = (typeof trainingMasteryLevels)[number]
export const trainingMasteryLabels = {
  "weak": "薄弱",
  "aware": "了解",
  "familiar": "熟悉",
  "mastered": "掌握"
} as const
export const aiEnhanceTypes = ["pointWeak","highFrequencyWeak","errorProneWeak","pastExamWeak","comprehensive"] as const
export type AiEnhanceType = (typeof aiEnhanceTypes)[number]
export const aiEnhanceLabels = {
  "pointWeak": "考点薄弱补强",
  "highFrequencyWeak": "高频考点补强",
  "errorProneWeak": "易错题补强",
  "pastExamWeak": "真题薄弱补强",
  "comprehensive": "综合能力补强"
} as const
