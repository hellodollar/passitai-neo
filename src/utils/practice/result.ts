import type {
  PracticePaperDetail,
  PracticePaperItem,
  PracticeResultQuestionStatus,
  PracticeSubmission,
  PracticeSubmissionResult,
} from '@/types'

import { isAnswerCorrect, isChoiceQuestionType } from './question'

function questionStatus(item: PracticePaperItem, userAnswer: string): PracticeResultQuestionStatus {
  if (!userAnswer) return 'unanswered'
  if (!isChoiceQuestionType(item.questionType) || !item.correctAnswer) return 'pending'
  return isAnswerCorrect({ questionId: item.id, text: userAnswer, values: [userAnswer] }, item)
    ? 'correct'
    : 'wrong'
}

/** 用本次交卷和题集快照构造页面报告，不请求或写入服务端。 */
export function buildSubmissionResult(
  detail: PracticePaperDetail,
  submission: PracticeSubmission,
  paperId: string,
  subjectName: string,
): PracticeSubmissionResult {
  let index = 0
  const questions = detail.paper.sections.flatMap((group) =>
    group.items.map((item) => {
      index += 1
      const answer = submission.userAnswers[item.id]
      const userAnswer = Array.isArray(answer) ? answer.join('、') : (answer ?? '')
      return {
        id: item.id,
        index,
        title: item.title,
        questionType: item.questionType,
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
    paperId,
    paperName: detail.paper.name,
    subjectName,
    score: submission.score,
    totalCount,
    answeredCount: totalCount - unansweredCount,
    correctCount,
    wrongCount,
    unansweredCount,
    accuracy: gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : 0,
    elapsedSeconds:
      submission.startTime && submission.endTime
        ? Math.max(
            0,
            Math.round((Date.parse(submission.endTime) - Date.parse(submission.startTime)) / 1000),
          )
        : undefined,
    submittedAt: submission.endTime ?? undefined,
    questions,
  }
}
