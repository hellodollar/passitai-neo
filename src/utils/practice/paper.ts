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
