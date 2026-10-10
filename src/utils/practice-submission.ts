import type {
  PracticePendingSubmission,
  PracticeRecord,
  PracticeSubmission,
  SubmitPracticePaperBody,
} from '@/types'
import { isPracticeRecordCurrent } from '@/utils/practice-record-control'

type SubmissionPlan =
  | { kind: 'report'; submissionId: string; record: PracticeRecord }
  | {
      kind: 'submit'
      pending: PracticePendingSubmission & { payload: SubmitPracticePaperBody }
      record: PracticeRecord
    }

function createSubmissionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return `rec_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

/** 同版本复用报告；失败重试使用原 ID 和快照，不读取正在编辑的输入。 */
export function preparePracticeSubmission(
  record: PracticeRecord,
  userAnswers: SubmitPracticePaperBody['userAnswers'],
  generateId = createSubmissionId,
): SubmissionPlan {
  if (record.source !== 'practice') throw new Error('收藏和错题练习不支持交卷。')
  if (!isPracticeRecordCurrent(record)) throw new Error('本地做题记录已清除，请重新作答。')
  if (record.lastSubmission?.answerRevision === record.answerRevision) {
    return { kind: 'report', submissionId: record.lastSubmission.submissionId, record }
  }

  const existing = record.pendingSubmission
  const submissionId =
    existing?.answerRevision === record.answerRevision ? existing.submissionId : generateId()
  const pending = {
    submissionId,
    answerRevision: record.answerRevision,
    payload:
      existing?.answerRevision === record.answerRevision && existing.payload
        ? existing.payload
        : {
            submissionId,
            userAnswers: Object.fromEntries(
              Object.entries(userAnswers).map(([id, answer]) => [
                id,
                Array.isArray(answer) ? [...answer] : answer,
              ]),
            ),
            startTime: new Date(record.startedAt).toISOString(),
          },
  }
  return {
    kind: 'submit',
    pending,
    record: { ...record, pendingSubmission: pending, savedAt: Date.now() },
  }
}

/** 成功交卷仅更新提交元信息，绝不覆盖答案、未确认输入和当前位置。 */
export function settlePracticeSubmission(
  record: PracticeRecord,
  submittedRecord: PracticeRecord,
  submission: PracticeSubmission,
  now = Date.now(),
): PracticeRecord {
  const pending = submittedRecord.pendingSubmission
  if (
    record.source !== 'practice' ||
    !isPracticeRecordCurrent(record) ||
    !isPracticeRecordCurrent(submittedRecord) ||
    record.userId !== submittedRecord.userId ||
    record.source !== submittedRecord.source ||
    record.paperId !== submittedRecord.paperId ||
    !pending ||
    submission.paperId !== record.paperId ||
    submission.id !== pending.submissionId ||
    pending.answerRevision > record.answerRevision
  ) {
    throw new Error('交卷结果与当前练习不一致，请重新进入后重试。')
  }

  const currentPending = record.pendingSubmission
  const last = record.lastSubmission
  return {
    ...record,
    pendingSubmission:
      currentPending?.submissionId === pending.submissionId &&
      currentPending.answerRevision === pending.answerRevision
        ? null
        : currentPending,
    // 较早请求迟到时，不覆盖较新版本已经取得的报告。
    lastSubmission:
      last && last.answerRevision > pending.answerRevision
        ? last
        : {
            submissionId: submission.id,
            answerRevision: pending.answerRevision,
            submittedAt: submission.endTime ?? new Date(now).toISOString(),
          },
    savedAt: now,
  }
}
