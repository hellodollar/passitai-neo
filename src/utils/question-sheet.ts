import type { QuestionSheetGroup } from '@/utils/practice-session'

export const QUESTION_SHEET_RANGE_SIZE = 20

/** 大题集按固定题号区间展示，避免答题卡一次渲染全部题号。 */
export function getQuestionSheetRanges(total: number, rangeSize = QUESTION_SHEET_RANGE_SIZE) {
  return Array.from({ length: Math.ceil(Math.max(0, total) / rangeSize) }, (_, index) => {
    const start = index * rangeSize
    const end = Math.min(start + rangeSize, total)
    return { index, label: `${start + 1}–${end}`, start, end }
  })
}

/** 截取当前区间，同时保留每个 Section 对应的全局题号索引。 */
export function getVisibleQuestionSheetGroups(
  groups: QuestionSheetGroup[],
  total: number,
  rangeIndex: number,
  rangeSize = QUESTION_SHEET_RANGE_SIZE,
) {
  const start = Math.max(0, rangeIndex) * rangeSize
  const end = Math.min(start + rangeSize, total)
  return groups.flatMap((group) => {
    const visibleStart = Math.max(start, group.startIndex)
    const visibleEnd = Math.min(end, group.startIndex + group.questions.length)
    if (visibleStart >= visibleEnd) return []
    return [
      {
        ...group,
        startIndex: visibleStart,
        questions: group.questions.slice(
          visibleStart - group.startIndex,
          visibleEnd - group.startIndex,
        ),
      },
    ]
  })
}
