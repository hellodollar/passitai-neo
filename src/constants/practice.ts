import { Flame, ShieldAlert, Target } from '@lucide/vue'
import type { DomainValue } from '@/generated/domain-values'

export const PRACTICE_CATEGORY_LABELS: Record<DomainValue<'paperType'>, string> = {
  baseline: '专项训练',
  pastExam: '历年真题',
  mock: '考前模拟',
  ai: 'AI训练',
}

/**
 * baseline 子项(专项训练)视觉字典:assessmentType -> 图标。
 * 与后端 PaperAssessmentPreset 取值对应；文案取题集名称，前端只配置展示形态。
 */
export const BASELINE_CHILD_ICONS: Record<string, typeof Target> = {
  overall: Target,
  highFrequency: Flame,
  errorProne: ShieldAlert,
}
