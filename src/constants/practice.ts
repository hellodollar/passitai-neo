import type {
  PracticeResourceType,
  TrainingMasteryLevel,
} from '@/generated/practice-resource-values'
import type {
  EvaluationConfidence,
  EvaluationReadinessLevel,
  EvaluationTriggerType,
  PracticeResultQuestionStatus,
  SubjectiveSelfGradeRating,
} from '@/types'

export const RESULT_STATUS_LABELS: Record<PracticeResultQuestionStatus, string> = {
  correct: '回答正确',
  wrong: '回答错误',
  unanswered: '未作答',
  pending: '待自评',
  graded: '已自评',
}

/** 本地做题记录存储结构版本；存储约定见 docs/frontend-contract.md。 */
export const PRACTICE_RECORD_VERSION = 3

export const SUBJECTIVE_SELF_GRADE_OPTIONS: ReadonlyArray<{
  value: SubjectiveSelfGradeRating
  label: string
  ratio: string
  activeClass: string
}> = [
  {
    value: 'mastered',
    label: '掌握',
    ratio: '100%',
    activeClass: 'border-success/40 bg-success/10 font-semibold text-success dark:bg-success/15',
  },
  {
    value: 'partial',
    label: '部分掌握',
    ratio: '50%',
    activeClass: 'border-warning/40 bg-warning/10 font-semibold text-warning dark:bg-warning/15',
  },
  {
    value: 'missed',
    label: '未掌握',
    ratio: '0%',
    activeClass: 'border-error/40 bg-error/10 font-semibold text-error dark:bg-error/15',
  },
]

export const EVALUATION_READINESS_META: Record<
  EvaluationReadinessLevel,
  { label: string; badgeClass: string }
> = {
  ready: { label: '可上考场', badgeClass: 'bg-success/10 text-success dark:bg-success/15' },
  close: { label: '接近过线', badgeClass: 'bg-info/10 text-info dark:bg-info/15' },
  building: { label: '巩固提升', badgeClass: 'bg-warning/10 text-warning dark:bg-warning/15' },
  starter: {
    label: '起步阶段',
    badgeClass: 'bg-base-200/80 text-base-content/70 dark:bg-base-300/50',
  },
}

export const EVALUATION_CONFIDENCE_LABELS: Record<EvaluationConfidence, string> = {
  high: '高置信',
  medium: '中置信',
  low: '低置信',
}

export const EVALUATION_TRIGGER_LABELS: Record<EvaluationTriggerType, string> = {
  manual: '手动评估',
  practice: '交卷评估',
  baseline: '基准评估',
}

/** 四档掌握度语义色；文案统一来自 src/generated/practice-resource-values.ts。 */
export const TRAINING_MASTERY_BADGE_CLASSES: Record<TrainingMasteryLevel, string> = {
  weak: 'bg-error/10 text-error dark:bg-error/15',
  aware: 'bg-warning/10 text-warning dark:bg-warning/15',
  familiar: 'bg-info/10 text-info dark:bg-info/15',
  mastered: 'bg-success/10 text-success dark:bg-success/15',
}

export const PRACTICE_RESOURCE_SLOT_FALLBACK_LABELS: Record<PracticeResourceType, string> = {
  baseline: '基准能力',
  mockExams: '模拟考试',
  pastExams: '历年真题',
  aiEnhance: 'AI 增强',
}
