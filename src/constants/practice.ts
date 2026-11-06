import type { DomainValue } from '@/generated/domain-values'
import type { PracticeResultQuestionStatus } from '@/types'

export const RESULT_STATUS_LABELS: Record<PracticeResultQuestionStatus, string> = {
  correct: '回答正确',
  wrong: '回答错误',
  unanswered: '未作答',
  pending: '待批阅',
}

export const PRACTICE_CATEGORY_LABELS: Record<DomainValue<'paperType'>, string> = {
  baseline: '专项训练',
  pastExam: '历年真题',
  mock: '考前模拟',
  ai: 'AI训练',
}

/** 本地做题记录存储结构版本；存储约定见 docs/practice-local-records.md。 */
export const PRACTICE_RECORD_VERSION = 3
