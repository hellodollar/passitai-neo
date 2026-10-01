import { Flame, ShieldAlert, Target } from '@lucide/vue'

/**
 * baseline 子项(专项训练)视觉字典:assessmentType -> 图标。
 * 与后端 BaselineAssessmentEntries 字典(paper 常量)一一对应,
 * 文案以后端返回的 name 为准,前端只配置展示形态。
 */
export const BASELINE_CHILD_ICONS: Record<string, typeof Target> = {
  overall: Target,
  highFrequency: Flame,
  errorProne: ShieldAlert,
}

/** 兜底顺序(旧数据缺 assessmentType 时按位置取) */
export const BASELINE_CHILD_ICON_FALLBACKS = [Target, Flame, ShieldAlert] as const
