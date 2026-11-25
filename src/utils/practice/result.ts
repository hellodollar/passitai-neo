import type {
  PaperDetail,
  PaperQuestion,
  PracticeResultQuestionStatus,
  PracticeResultSection,
  PracticeSubmission,
  PracticeSubmissionResult,
  SubjectiveSelfGradeRating,
} from '@/types'

import { isAnswerCorrect, isChoiceQuestionType } from './question'

const SELF_GRADE_MULTIPLIER: Record<SubjectiveSelfGradeRating, number> = {
  mastered: 1,
  partial: 0.5,
  missed: 0,
}

function questionStatus(
  item: PaperQuestion,
  userAnswer: string,
  subjectiveGraded: boolean,
): PracticeResultQuestionStatus {
  if (!userAnswer) return 'unanswered'
  if (!isChoiceQuestionType(item.type) || !item.correctAnswer) {
    return subjectiveGraded ? 'graded' : 'pending'
  }
  return isAnswerCorrect(
    { questionId: item.id, text: userAnswer, values: [userAnswer] },
    { ...item, questionType: item.type },
  )
    ? 'correct'
    : 'wrong'
}

/** 用本次交卷和题集快照构造页面报告，不请求或写入服务端。 */
export function buildSubmissionResult(
  paper: PaperDetail,
  submission: PracticeSubmission,
  subjectName: string,
): PracticeSubmissionResult {
  const subjectiveGraded = submission.subjectiveScore !== null
  let index = 0
  const sections: PracticeResultSection[] = paper.sections.map((section) => ({
    name: section.name,
    questionType: section.questionType,
    perScore: section.perScore,
    answerCount: section.answerCount,
    questionIds: section.items.map((item) => item.id),
  }))

  const questions = paper.sections.flatMap((group, sectionIndex) =>
    group.items.map((item) => {
      index += 1
      const answer = submission.userAnswers[item.id]
      const userAnswer = Array.isArray(answer) ? answer.join('、') : (answer ?? '')
      return {
        id: item.id,
        index,
        title: item.title,
        questionType: item.type,
        sectionIndex,
        userAnswer,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation ?? undefined,
        status: questionStatus(item, userAnswer, subjectiveGraded),
      }
    }),
  )

  const correctCount = questions.filter((question) => question.status === 'correct').length
  const wrongCount = questions.filter((question) => question.status === 'wrong').length
  const unansweredCount = questions.filter((question) => question.status === 'unanswered').length
  const totalCount = questions.length
  const gradedCount = correctCount + wrongCount

  return {
    submissionId: submission.id,
    subjectCode: submission.subjectCode || paper.subjectCode,
    paperId: paper.id,
    paperName: submission.paperName || paper.name,
    subjectName,
    objectiveScore: submission.objectiveScore,
    subjectiveScore: submission.subjectiveScore,
    score: submission.score,
    totalCount,
    answeredCount: totalCount - unansweredCount,
    correctCount,
    wrongCount,
    unansweredCount,
    accuracy: gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : 0,
    elapsedSeconds: submission.durationSeconds ?? undefined,
    submittedAt: submission.createdAt || undefined,
    sections,
    questions,
  }
}

/** 按分组规则预计主观自评得分，选答题分组按最高 answerCount 题汇总封顶。 */
export function estimateSubjectiveSelfGrade(
  result: Pick<
    PracticeSubmissionResult,
    'totalCount' | 'objectiveScore' | 'sections' | 'questions'
  >,
  ratings: Record<string, SubjectiveSelfGradeRating>,
): { subjectiveScore: number; totalScore: number | null } {
  const fallbackUnitScore = 100 / Math.max(1, result.totalCount)
  const sections =
    result.sections && result.sections.length > 0
      ? result.sections
      : [
          {
            name: '主观题',
            questionIds: result.questions.map((question) => question.id),
          },
        ]
  const questionById = new Map(result.questions.map((question) => [question.id, question]))

  let totalSubjective = 0
  for (const section of sections) {
    const unitScore =
      typeof section.perScore === 'number' && section.perScore > 0
        ? section.perScore
        : fallbackUnitScore
    const scores: number[] = []
    for (const questionId of section.questionIds) {
      const question = questionById.get(questionId)
      const rating = ratings[questionId]
      if (
        !question ||
        !rating ||
        isChoiceQuestionType(question.questionType) ||
        !question.userAnswer
      ) {
        continue
      }
      scores.push(unitScore * SELF_GRADE_MULTIPLIER[rating])
    }
    scores.sort((a, b) => b - a)
    const capCount =
      typeof section.answerCount === 'number' && section.answerCount > 0
        ? Math.min(section.answerCount, section.questionIds.length)
        : section.questionIds.length
    for (const score of scores.slice(0, capCount)) {
      totalSubjective += score
    }
  }

  const subjectiveScore = Math.round(totalSubjective * 10) / 10
  const totalScore =
    result.objectiveScore !== null
      ? Math.round((result.objectiveScore + subjectiveScore) * 10) / 10
      : null
  return { subjectiveScore, totalScore }
}
