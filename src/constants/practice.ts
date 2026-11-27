import type { TrainingMasteryLevel } from '@/generated/practice-resource-values'
import type { PracticeResultQuestionStatus, SubjectiveSelfGradeRating } from '@/types'

export const RESULT_STATUS_LABELS: Record<PracticeResultQuestionStatus, string> = {
  correct: '回答正确',
  wrong: '回答错误',
  unanswered: '未作答',
  pending: '待自评',
  graded: '已自评',
}

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

/** 四档掌握度柔和语义色（weak 默认柔灰）；文案统一来自 src/generated/practice-resource-values.ts。 */
export const TRAINING_MASTERY_BADGE_CLASSES: Record<TrainingMasteryLevel, string> = {
  weak: 'bg-base-200/80 text-base-content/55 dark:bg-base-300/50',
  aware: 'bg-info/10 text-info dark:bg-info/15',
  familiar: 'bg-primary/10 text-primary dark:bg-primary/15',
  mastered: 'bg-success/10 text-success dark:bg-success/15',
}
