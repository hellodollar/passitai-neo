import type { DomainValue } from '@/generated/domain-values'

export const PRACTICE_CATEGORY_LABELS: Record<DomainValue<'paperType'>, string> = {
  baseline: '专项训练',
  pastExam: '历年真题',
  mock: '考前模拟',
  ai: 'AI训练',
}

/** 本地做题记录存储结构版本；迁移策略见 docs/practice-local-records.md。 */
export const PRACTICE_RECORD_VERSION = 2
