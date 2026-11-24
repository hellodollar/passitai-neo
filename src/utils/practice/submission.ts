import type {
  PracticePendingSubmission,
  PracticeRecord,
  PracticeSubmission,
  SubmitPracticePaperBody,
} from '@/types'

import { isPracticeRecordCurrent } from './record-control'

type SubmissionPlan =
  | { kind: 'report'; submissionId: string; record: PracticeRecord }
  | {
      kind: 'submit'
      pending: PracticePendingSubmission
      record: PracticeRecord
    }

const MAX_DURATION_SECONDS = 86_400

function createSubmissionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(6))
  return `rec${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

export function computeDurationSeconds(startedAt: number, now = Date.now()) {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now)) return 0
  return Math.min(MAX_DURATION_SECONDS, Math.max(0, Math.round((now - startedAt) / 1000)))
}

/** 同版本复用报告；失败重试使用原 ID 和快照，不读取正在编辑的输入。 */
export function preparePracticeSubmission(
  record: PracticeRecord,
  userAnswers: SubmitPracticePaperBody['userAnswers'],
  generateId = createSubmissionId,
  now = Date.now(),
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
      existing?.answerRevision === record.answerRevision
        ? existing.payload
        : {
            submissionId,
            userAnswers: Object.fromEntries(
              Object.entries(userAnswers).map(([id, answer]) => [
                id,
                Array.isArray(answer) ? [...answer] : answer,
              ]),
            ),
            durationSeconds: computeDurationSeconds(record.startedAt, now),
          },
  }
  return {
    kind: 'submit',
    pending,
    record: { ...record, pendingSubmission: pending, savedAt: now },
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
            submittedAt: submission.createdAt || new Date(now).toISOString(),
          },
    savedAt: now,
  }
}
