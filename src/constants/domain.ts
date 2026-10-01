import { domainValues, questionTypeLabels } from '@/generated/domain-values'
import type { QuestionType } from '@/types/domain'

export const QUESTION_TYPE_LABELS = questionTypeLabels

export const QUESTION_TYPE_ORDER = Object.fromEntries(
  domainValues.questionType.map((type, index) => [type, index]),
) as Record<QuestionType, number>
