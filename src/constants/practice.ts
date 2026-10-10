import type { DomainValue } from '@/generated/domain-values'
import type { PracticeSettings } from '@/types/practice'

export const PRACTICE_CATEGORY_LABELS: Record<DomainValue<'paperType'>, string> = {
  baseline: '专项训练',
  pastExam: '历年真题',
  mock: '考前模拟',
  ai: 'AI训练',
}

/** 刷题设置默认值；与 PracticeSettings 协议对齐，使用时克隆，避免共享可变对象。 */
export const DEFAULT_PRACTICE_SETTINGS: Readonly<PracticeSettings> = {
  autoNext: false,
  recordWrongQuestions: true,
  showExplanationAfterAnswer: true,
  loopAfterCompletion: false,
  autoSubmitAfterCompletion: false,
  removeMistakeOnCorrect: false,
}

/** 本地做题记录存储结构版本；迁移策略见 docs/practice-local-records.md。 */
export const PRACTICE_RECORD_VERSION = 2
