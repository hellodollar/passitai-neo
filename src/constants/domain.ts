import { domainValues } from '@/generated/domain-values'
import type { QuestionType } from '@/types/domain'

export const QUESTION_TYPE_LABELS = {
  single: '单选题',
  multiple: '多选题',
  judge: '判断题',
  nounExplain: '名词解释题',
  shortAnswer: '简答题',
  essay: '论述题',
} satisfies Record<QuestionType, string>

export const QUESTION_TYPE_ORDER = Object.fromEntries(
  domainValues.questionType.map((type, index) => [type, index]),
) as Record<QuestionType, number>
