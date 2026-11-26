import type { PracticeSource, SubmitPracticePaperBody } from './practice'

export type PracticeRecordIdentity = {
  userId: string
  paperId: string
  source: PracticeSource
}

export type PracticeRecordContext = PracticeRecordIdentity & {
  subjectId: string
}

/** 单题运行时作答；不含指纹，指纹在写入本地记录时按题目内容补充。 */
export type PracticeAnswerRecord = {
  questionId: string
  text: string
  values: string[]
}

/** 本地记录里的单题存储形态：作答 + 题目指纹（题目变化时校验失效）。 */
export type PracticeRecordAnswer = PracticeAnswerRecord & {
  fingerprint: string
}

export type PracticePendingSubmission = {
  submissionId: string
  answerRevision: number
  /** 固定的提交请求快照，重试沿用同一份内容。 */
  payload: SubmitPracticePaperBody
}

export type PracticeLastSubmission = {
  submissionId: string
  answerRevision: number
  submittedAt: string
}

/** 本地做题记录与服务端交卷记录独立；交卷状态不能作为答案是否存在的依据。 */
export type PracticeRecord = PracticeRecordContext & {
  /** 清理代际；已清理的内存记录不能回写。 */
  clearToken: string
  startedAt: number
  currentQuestionId: string
  answers: Record<string, PracticeRecordAnswer>
  inputs: Record<string, PracticeRecordAnswer>
  /** 只在已确认答案或题目指纹变化时递增，输入、切题不改变版本。 */
  answerRevision: number
  pendingSubmission: PracticePendingSubmission | null
  lastSubmission: PracticeLastSubmission | null
  savedAt: number
}

export type PracticeRecordClearScope =
  | { kind: 'paper'; identity: PracticeRecordIdentity }
  | { kind: 'all'; userId: string }

export type PracticeRecordProgress = {
  startedAt: number
  currentQuestionId: string
  answers: Record<string, PracticeRecordAnswer>
  inputs: Record<string, PracticeRecordAnswer>
  pendingSubmissionId: string
  submissionAnswers: SubmitPracticePaperBody['userAnswers']
}
