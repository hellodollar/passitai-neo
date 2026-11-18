import type { PaperLayout, PaperType } from '@/types/paper'

export const PAPER_TYPE_LABELS: Record<PaperType, string> = {
  pointCoverage: '考点通练',
  highFrequency: '高频考点',
  errorTarget: '易错强化',
}

export const PAPER_LAYOUT_LABELS: Record<PaperLayout, string> = {
  custom: '练习',
  exam: '试卷',
}
