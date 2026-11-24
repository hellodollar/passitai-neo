import type {
  PaperDetail,
  PaperQuestion,
  PracticeResultQuestionStatus,
  PracticeSubmission,
  PracticeSubmissionResult,
} from '@/types'

import { isAnswerCorrect, isChoiceQuestionType } from './question'

function questionStatus(item: PaperQuestion, userAnswer: string): PracticeResultQuestionStatus {
  if (!userAnswer) return 'unanswered'
  if (!isChoiceQuestionType(item.type) || !item.correctAnswer) return 'pending'
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
  let index = 0
  const questions = paper.sections.flatMap((group) =>
    group.items.map((item) => {
      index += 1
      const answer = submission.userAnswers[item.id]
      const userAnswer = Array.isArray(answer) ? answer.join('、') : (answer ?? '')
      return {
        id: item.id,
        index,
        title: item.title,
        questionType: item.type,
        userAnswer,
        correctAnswer: item.correctAnswer,
        explanation: item.explanation ?? undefined,
        status: questionStatus(item, userAnswer),
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
    questions,
  }
}
