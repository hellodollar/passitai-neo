import type { TrainingMasteryLevel } from '@/generated/practice-resource-values'
import type { PracticeResource, UserSubjectProfileLatestEvaluation } from '@/types'
import { formatShanghaiDate } from '@/utils/date'

/** 柔和四档语义色（去警告红/黄）：weak 柔灰 / aware 清蓝 / familiar 鸢尾主色 / mastered 清绿。 */
const MASTERY_SCORE_TEXT_CLASSES: Record<TrainingMasteryLevel, string> = {
  weak: 'text-base-content/55',
  aware: 'text-info',
  familiar: 'text-primary',
  mastered: 'text-success',
}

export function formatProfileScore(value: number) {
  const rounded = Math.round(value * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

/** PassIt 四档分数语义色：默认起步柔灰，随掌握度渐进清蓝 / 鸢尾 / 清绿。 */
export function getPassItScoreColorClass(
  evaluation: Pick<UserSubjectProfileLatestEvaluation, 'masteryLevel'> | null | undefined,
): string {
  if (!evaluation) return 'text-base-content/35'
  return MASTERY_SCORE_TEXT_CLASSES[evaluation.masteryLevel] ?? 'text-base-content/55'
}

/** 统计当前科目全部去重题集数与总题量。 */
export function summarizeResourceTotals(resources: PracticeResource[]) {
  const seen = new Set<string>()
  let paperCount = 0
  let questionCount = 0
  for (const resource of resources) {
    for (const paper of resource.list) {
      if (seen.has(paper.id)) continue
      seen.add(paper.id)
      paperCount++
      questionCount += Math.max(0, paper.questionCount || 0)
    }
  }
  return { paperCount, questionCount }
}

/** 按上海时区日历边界统计今日、近 7 日与近 30 天累计练习题数。 */
export function summarizeRecentPracticeVolume(
  records: ReadonlyArray<{ answeredCount: number; createdAt: string }>,
  now = new Date(),
) {
  const todayDayMs = Date.parse(formatShanghaiDate(now))
  let todayAnswered = 0
  let weeklyAnswered = 0
  let monthlyAnswered = 0

  for (const record of records) {
    const count =
      typeof record.answeredCount === 'number' && Number.isFinite(record.answeredCount)
        ? Math.max(0, record.answeredCount)
        : 0
    if (count === 0) continue
    const createdAt = new Date(record.createdAt)
    if (Number.isNaN(createdAt.getTime())) continue
    const recordDayMs = Date.parse(formatShanghaiDate(createdAt))
    const dayDiff = Math.round((todayDayMs - recordDayMs) / 86_400_000)
    if (dayDiff === 0) todayAnswered += count
    if (dayDiff >= 0 && dayDiff < 7) weeklyAnswered += count
    if (dayDiff >= 0 && dayDiff < 30) monthlyAnswered += count
  }

  return { todayAnswered, weeklyAnswered, monthlyAnswered }
}
