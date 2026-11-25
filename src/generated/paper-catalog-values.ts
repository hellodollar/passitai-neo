// Generated from passitai-api/src/shared/constants/paper.ts.
export const catalogPaperTypes = ["pointCoverage","highFrequency","errorTarget","realSource"] as const
export const catalogPaperModes = ["bank","exam"] as const
export type PaperMode = (typeof catalogPaperModes)[number]
export const catalogPaperTypeLabels = {
  "pointCoverage": "考点覆盖",
  "highFrequency": "高频考点",
  "errorTarget": "易错题",
  "realSource": "真题"
} as const
