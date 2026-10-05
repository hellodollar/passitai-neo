import type { DomainValue } from '@/generated/domain-values'
import type { SubmitPracticePaperBody } from '@/types/domain'

export const PRACTICE_RECORD_VERSION = 2

export type PracticeRecordSource = 'practice' | 'favorites' | 'wrong-questions'

export type PracticeRecordIdentity = {
  userId: string
  paperId: string
  source: PracticeRecordSource
}

export type PracticeRecordContext = PracticeRecordIdentity & {
  subjectId: string
  /** 收藏、错题聚合训练不属于某一种题集分类。 */
  paperType: DomainValue<'paperType'> | null
}

export type PracticeRecordAnswer = {
  questionId: string
  fingerprint: string
  text: string
  values: string[]
}

export type PracticePendingSubmission = {
  submissionId: string
  answerRevision: number
  /** v1 只有提交 ID；加载题目后补齐快照，再用于提交重试。 */
  payload: SubmitPracticePaperBody | null
}

export type PracticeLastSubmission = {
  submissionId: string
  answerRevision: number
  submittedAt: string
}

/** 本地做题记录与服务端交卷记录独立；交卷状态不能作为答案是否存在的依据。 */
export type PracticeRecord = PracticeRecordContext & {
  version: typeof PRACTICE_RECORD_VERSION
  /** 清理代际；旧 v2 缺失时按空串迁移，已清理的内存记录不能回写。 */
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
  | { kind: 'category'; userId: string; paperType: NonNullable<PracticeRecordContext['paperType']> }
  | { kind: 'all'; userId: string }

export type PracticeRecordProgress = {
  startedAt: number
  currentQuestionId: string
  answers: Record<string, PracticeRecordAnswer>
  inputs: Record<string, PracticeRecordAnswer>
  pendingSubmissionId: string
  submissionAnswers: SubmitPracticePaperBody['userAnswers']
}
