import { questionTypeLabels } from '@/generated/domain-values'
import type { PracticePaperItem, PracticePaperLite, QuestionListItem } from '@/types'

import { shuffleWithSeed } from './order'
import { toQuestionListItem } from './question'
import { questionFingerprint } from './record'

export type AnswerSheetGroup = {
  key: string
  label: string
  startIndex: number
  questions: QuestionListItem[]
  perScore?: number
  answerCount?: number
}

export function isSelectiveGroup(
  group: Pick<AnswerSheetGroup, 'answerCount' | 'questions'> | undefined,
): boolean {
  return Boolean(
    group &&
    typeof group.answerCount === 'number' &&
    group.answerCount > 0 &&
    group.answerCount < group.questions.length,
  )
}

export function formatSectionSelectionNotice(
  group: Pick<AnswerSheetGroup, 'answerCount' | 'perScore' | 'questions'> | undefined,
): string {
  if (!isSelectiveGroup(group) || !group) return ''
  const count = group.answerCount!
  const total = group.questions.length
  if (typeof group.perScore === 'number' && group.perScore > 0) {
    const maxScore = Math.round(count * group.perScore * 100) / 100
    return `本大题任选 ${count} 题作答（共 ${total} 题，每题 ${group.perScore} 分，满分 ${maxScore} 分）`
  }
  return `本大题任选 ${count} 题作答（共 ${total} 题）`
}

export function summarizePracticeCompletion(
  groups: AnswerSheetGroup[],
  answerRecords: Record<string, unknown>,
) {
  let requiredCount = 0
  let answeredRequiredCount = 0
  let remainingRequiredCount = 0
  const selectiveGroups: Array<{
    label: string
    required: number
    total: number
    answered: number
  }> = []

  for (const group of groups) {
    const total = group.questions.length
    const selective = isSelectiveGroup(group)
    const required = selective ? group.answerCount! : total
    const answered = group.questions.filter((question) =>
      Boolean(answerRecords[question.id]),
    ).length
    requiredCount += required
    answeredRequiredCount += Math.min(required, answered)
    remainingRequiredCount += Math.max(0, required - answered)
    if (selective) {
      selectiveGroups.push({ label: group.label, required, total, answered })
    }
  }

  return { requiredCount, answeredRequiredCount, remainingRequiredCount, selectiveGroups }
}

/** 将 API 题集按原 Section/题目顺序整理为练习页所需的题目、分组与指纹。 */
export function preparePracticePaper(paper: PracticePaperLite) {
  const questions: QuestionListItem[] = []
  const groups: AnswerSheetGroup[] = []
  const fingerprints: Record<string, string> = {}
  const itemsById = new Map<string, PracticePaperItem>()

  for (const [index, section] of paper.sections.entries()) {
    const groupQuestions = section.items.map((item) => toQuestionListItem(item, paper.subjectId))
    for (const item of section.items) {
      fingerprints[item.id] = questionFingerprint(item)
      itemsById.set(item.id, item)
    }
    groups.push({
      key: `${paper.id ?? paper.subjectId}-${index}`,
      label:
        section.name ||
        (section.questionType ? questionTypeLabels[section.questionType] : `Section ${index + 1}`),
      startIndex: questions.length,
      questions: groupQuestions,
      perScore: section.perScore,
      answerCount: section.answerCount,
    })
    questions.push(...groupQuestions)
  }

  return { questions, groups, fingerprints, itemsById }
}

/** 只调整组内展示顺序，分组起始索引、题目内容、指纹和题目 ID 保持对应。 */
export function orderPracticePaper(
  prepared: ReturnType<typeof preparePracticePaper>,
  seed: string,
) {
  const groups = prepared.groups.map((group) => ({
    ...group,
    questions: shuffleWithSeed(group.questions, `${seed}|${group.key}`),
  }))
  return { ...prepared, groups, questions: groups.flatMap((group) => group.questions) }
}
