import type { PracticeEntry } from '@/types/domain'
import type { PracticeRecord } from '@/types/practice-record'

/** 首页只以本地已确认答案回填进度，接口只提供题集目录与总题数。 */
export function applyLocalPracticeProgress(
  entries: PracticeEntry[],
  records: PracticeRecord[],
  userId: string,
  subjectId: string,
): PracticeEntry[] {
  const byPaper = new Map(
    records
      .filter(
        (record) =>
          record.userId === userId &&
          record.source === 'practice' &&
          record.subjectId === subjectId,
      )
      .map((record) => [record.paperId, record]),
  )
  return entries.map((entry) => {
    const children = entry.children?.map((child) => {
      const record = byPaper.get(child.paperId)
      const count =
        record?.paperType === entry.type
          ? Object.values(record.answers).filter(
              (answer) => answer.values.length > 0 || Boolean(answer.text.trim()),
            ).length
          : 0
      return { ...child, answeredCount: Math.min(Math.max(0, child.questionCount), count) }
    })
    return {
      ...entry,
      children,
      answeredCount: children?.reduce((sum, child) => sum + child.answeredCount, 0) ?? 0,
    }
  })
}
