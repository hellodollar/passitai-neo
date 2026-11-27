import type { ProvinceCode } from '@/generated/domain-values'
import type {
  AiEnhanceType,
  PracticeResourceType,
  TrainingMasteryLevel,
} from '@/generated/practice-resource-values'

import type { PaperMode, PaperType } from './paper'
import type { QuestionType } from './question'

export type EvaluationTriggerType = 'manual' | 'practice' | 'baseline'
export type EvaluationReadinessLevel = 'ready' | 'close' | 'building' | 'starter'
export type EvaluationConfidence = 'low' | 'medium' | 'high'
export type EvaluationGapCode =
  | 'point_weak'
  | 'question_type_weak'
  | 'mistake_unresolved'
  | 'review_overdue'
  | 'baseline_missing'
  | 'past_exam_insufficient'
  | 'mock_exam_missing'
  | 'ai_enhance_missing'
  | 'subjective_insufficient'
export type EvaluationGapSeverity = 'high' | 'medium' | 'low'
export type EvaluationActionType = 'paper' | 'mistakes' | 'aiGenerate'

export type UserSubjectProfilePointStat = {
  attempted: number
  correct: number
  wrongCount: number
  mistakeCount: number
  mastery: number
  lastAt?: string
}

export type UserSubjectProfileQuestionTypeStat = {
  attempted: number
  correct: number
  wrongCount: number
  unresolvedMistakes: number
  avgScoreRate: number
}

export type UserSubjectProfilePaperProgress = {
  paperId: string
  paperName: string
  paperType: string
  paperMode: PaperMode
  totalQuestions: number
  coveredQuestions: number
  completedRounds: number
  currentRoundCoverage: number
  rawScore: number | null
  level: TrainingMasteryLevel
  lastPracticedAt?: string
  enhanceType?: AiEnhanceType
}

export type UserSubjectProfileSlotProgress = {
  resourceId?: string
  weight: number
  completedPapers: number
  totalPapers: number
  avgScore: number | null
  score: number
  level: TrainingMasteryLevel
  met: boolean
  papers: UserSubjectProfilePaperProgress[]
}

export type UserSubjectProfileLatestEvaluation = {
  id: string
  triggerType: EvaluationTriggerType
  estimatedScore: number
  objectiveEstimatedScore: number | null
  subjectiveEstimatedScore: number | null
  readinessLevel: EvaluationReadinessLevel
  confidence: EvaluationConfidence
  masteryLevel: TrainingMasteryLevel
  summary: string | null
  gapCount: number
  recommendationCount: number
  createdAt: string
}

export type UserSubjectProfile = {
  id: string
  subjectCode: string
  subjectName: string
  practiceCount: number
  answeredQuestions: number
  objectiveAnswered: number
  objectiveCorrect: number
  subjectiveAnswered: number
  unresolvedMistakes: number
  highFrequencyCoverage: number
  pointStats: Record<string, UserSubjectProfilePointStat>
  questionTypeStats: Partial<Record<QuestionType, UserSubjectProfileQuestionTypeStat>>
  trainingProgress: Partial<Record<PracticeResourceType, UserSubjectProfileSlotProgress>>
  latestEvaluationId: string | null
  latestEvaluation: UserSubjectProfileLatestEvaluation | null
  sourcePracticeAt: string | null
  generatedAt: string | null
  updatedAt: string | null
  createdAt: string
}

export type EvaluateUserSubjectBody = {
  triggerType?: EvaluationTriggerType
}

export type UserSubjectEvaluationStrength = {
  code: string
  title: string
  detail: string
  pointKeys?: string[]
}

export type UserSubjectEvaluationGap = {
  code: EvaluationGapCode
  title: string
  severity: EvaluationGapSeverity
  current: string
  target: string
  pointKeys?: string[]
}

export type UserSubjectEvaluationRecommendation = {
  gapCode: EvaluationGapCode
  actionType: EvaluationActionType
  priority: number
  title: string
  reason?: string
  paperId?: string
  resourceType?: PracticeResourceType
  enhanceType?: AiEnhanceType
  pointKeys?: string[]
  questionTypes?: QuestionType[]
}

export type UserSubjectEvaluationQuickScore = {
  baseline: number
  pastExams: number
  mockExams: number
  aiEnhance: number
  paperStructure: number
  objectiveRate: number | null
  subjectiveRate: number | null
}

export type UserSubjectEvaluationWeaknessProfile = {
  weakPointKeys: string[]
  stalePointKeys: string[]
  weakQuestionTypes: QuestionType[]
  stubbornMistakeCount: number
  confusionMistakeCount: number
}

export type UserSubjectEvaluationEvidence = {
  practiceCount: number
  answeredQuestions: number
  objectiveAnswered: number
  objectiveCorrect: number
  subjectiveAnswered: number
  unresolvedMistakes: number
  highFrequencyCoverage: number
  masteryLevel?: TrainingMasteryLevel
  slotScores?: Partial<Record<PracticeResourceType, number>>
  slotLevels?: Partial<Record<PracticeResourceType, TrainingMasteryLevel>>
  subjectProfileGeneratedAt?: string | null
  rawScore?: number
  memoryRetention?: number
  subjectivePassCapped?: boolean
  quickScore?: UserSubjectEvaluationQuickScore
  weaknessProfile?: UserSubjectEvaluationWeaknessProfile
}

export type UserSubjectEvaluation = {
  id: string
  subjectCode: string
  triggerType: EvaluationTriggerType
  estimatedScore: number
  objectiveEstimatedScore: number | null
  subjectiveEstimatedScore: number | null
  readinessLevel: EvaluationReadinessLevel
  confidence: EvaluationConfidence
  diagnosis: {
    summary?: string
    strengths: UserSubjectEvaluationStrength[]
    gaps: UserSubjectEvaluationGap[]
  }
  recommendations: UserSubjectEvaluationRecommendation[]
  evidenceSnapshot: UserSubjectEvaluationEvidence
  createdAt: string
}

export type GenerateAiEnhancePaperBody = {
  enhanceType: AiEnhanceType
  questionCount?: number
  pointKeys?: string[]
  questionTypes?: QuestionType[]
  name?: string
}

export type GeneratedAiEnhancePaper = {
  id: string
  subjectCode: string
  provinceCode: ProvinceCode
  name: string
  type: PaperType
  paperMode: PaperMode
  enhanceType: AiEnhanceType
  questionCount: number
  contentPeriod: string
  sourceType: 'ai'
  targetPointKeys: string[]
  targetQuestionTypes: QuestionType[]
  createdAt: string
}
