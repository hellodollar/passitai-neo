import { Flame, ShieldAlert, Target } from '@lucide/vue'

/**
 * baseline 子项(专项训练)视觉字典:assessmentType -> 图标。
 * 与后端 PaperAssessmentPreset 取值对应；文案取题集名称，前端只配置展示形态。
 */
export const BASELINE_CHILD_ICONS: Record<string, typeof Target> = {
  overall: Target,
  highFrequency: Flame,
  errorProne: ShieldAlert,
}

/** 兜底顺序(旧数据缺 assessmentType 时按位置取) */
export const BASELINE_CHILD_ICON_FALLBACKS = [Target, Flame, ShieldAlert] as const
