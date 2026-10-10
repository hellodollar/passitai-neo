import type {
  PracticePaperDetail,
  PracticePaperItem,
  PracticeResultQuestionStatus,
  PracticeSubmission,
  PracticeSubmissionResult,
  QuestionType,
} from '@/types'
import { isChoiceQuestionType } from '@/utils/practice-question'

function normalizeAnswer(answer: string, questionType: QuestionType) {
  if (questionType === 'judge') {
    const value = answer.trim().toUpperCase()
    if (value === 'A' || value === 'TRUE' || value === '正确') return 'TRUE'
    if (value === 'B' || value === 'FALSE' || value === '错误') return 'FALSE'
  }
  if (isChoiceQuestionType(questionType) && /^[A-F\s,，、;；]+$/i.test(answer)) {
    return [...new Set(answer.toUpperCase().match(/[A-F]/g) ?? [])].sort().join('')
  }
  return answer
    .toUpperCase()
    .split(/[\s,，、;；]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort()
    .join(',')
}

function questionStatus(item: PracticePaperItem, userAnswer: string): PracticeResultQuestionStatus {
  if (!userAnswer) return 'unanswered'
  if (!isChoiceQuestionType(item.questionType)) return 'pending'
  if (!item.correctAnswer) return 'pending'
  return normalizeAnswer(userAnswer, item.questionType) ===
    normalizeAnswer(item.correctAnswer, item.questionType)
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
