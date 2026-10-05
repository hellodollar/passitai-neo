import type { PracticePaperItem, QuestionListItem } from '@/types/domain'
import {
  getPreviewOptions,
  getQuestionOptions,
  type PracticeAnswerRecord,
} from '@/utils/practice-question'

const DRAFT_PREFIX = 'passitai:practice-draft:v1:'
const DRAFT_VERSION = 1

export type PracticeDraftAnswer = {
  questionId: string
  fingerprint: string
  text: string
  values: string[]
}

export type PracticeDraft = {
  version: typeof DRAFT_VERSION
  userId: string
  paperId: string
  startedAt: number
  currentQuestionId: string
  answers: Record<string, PracticeDraftAnswer>
  inputs: Record<string, PracticeDraftAnswer>
  pendingSubmissionId: string
  savedAt: number
}

function draftKey(userId: string, paperId: string) {
  return `${DRAFT_PREFIX}${userId}:${paperId}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function parseAnswers(value: unknown): Record<string, PracticeDraftAnswer> {
  if (!isObject(value)) return {}

  return Object.fromEntries(
    Object.entries(value).flatMap(([questionId, raw]) => {
      if (
        !isObject(raw) ||
        raw.questionId !== questionId ||
        typeof raw.fingerprint !== 'string' ||
        typeof raw.text !== 'string' ||
        !Array.isArray(raw.values) ||
        raw.values.length > 8 ||
        !raw.values.every((item) => typeof item === 'string' && item.length <= 32)
      )
        return []

      return [
        [
          questionId,
          {
            questionId,
            fingerprint: raw.fingerprint,
            text: raw.text,
            values: raw.values,
          },
        ],
      ]
    }),
  )
}

export function questionFingerprint(question: PracticePaperItem) {
  const content = [
    question.id,
    question.questionType,
    question.title,
    question.A,
    question.B,
    question.C,
    question.D,
    question.E,
    question.F,
  ].join('\u001f')
  let hash = 2166136261
  for (let index = 0; index < content.length; index++) {
    hash = Math.imul(hash ^ content.charCodeAt(index), 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

/** 恢复草稿时校验题目内容和选项，避免旧答案套用到已变化的题目。 */
export function restoreDraftAnswer(
  raw: PracticeDraftAnswer,
  question: QuestionListItem,
  fingerprint: string,
  confirmed: boolean,
): PracticeAnswerRecord | null {
  if (raw.fingerprint !== fingerprint) return null

  const choice = ['single', 'multiple', 'judge'].includes(question.questionType)
  if (choice) {
    const options = getQuestionOptions(question)
    const allowed = new Set(
      (options.length > 0 ? options : getPreviewOptions(question.questionType)).map(
        (option) => option.value,
      ),
    )
    if (
      raw.values.some((value) => !allowed.has(value)) ||
      (question.questionType !== 'multiple' && raw.values.length > 1) ||
      (confirmed && raw.values.length === 0)
    )
      return null
  } else if (raw.values.length > 0 || (confirmed && !raw.text.trim())) {
    return null
  }

  return { questionId: question.id, text: raw.text, values: raw.values }
}

export function readPracticeDraft(userId: string, paperId: string): PracticeDraft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(userId, paperId))
    if (!raw) return null
    const value: unknown = JSON.parse(raw)
    if (
      !isObject(value) ||
      value.version !== DRAFT_VERSION ||
      value.userId !== userId ||
      value.paperId !== paperId ||
      typeof value.startedAt !== 'number' ||
      !Number.isFinite(value.startedAt) ||
      value.startedAt <= 0 ||
      value.startedAt > Date.now() + 60_000
    )
      return null

    return {
      version: DRAFT_VERSION,
      userId,
      paperId,
      startedAt: value.startedAt,
      currentQuestionId: typeof value.currentQuestionId === 'string' ? value.currentQuestionId : '',
      answers: parseAnswers(value.answers),
      inputs: parseAnswers(value.inputs),
      pendingSubmissionId:
        typeof value.pendingSubmissionId === 'string' &&
        /^rec_[0-9a-f]{12}$/.test(value.pendingSubmissionId)
          ? value.pendingSubmissionId
          : '',
      savedAt: typeof value.savedAt === 'number' ? value.savedAt : 0,
    }
  } catch {
    return null
  }
}

export function writePracticeDraft(draft: PracticeDraft) {
  try {
    window.localStorage.setItem(draftKey(draft.userId, draft.paperId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function removePracticeDraft(userId: string, paperId: string) {
  try {
    window.localStorage.removeItem(draftKey(userId, paperId))
  } catch {
    // Storage may be unavailable; the in-memory attempt can still continue.
  }
}

export function clearUserPracticeDrafts(userId: string) {
  try {
    const prefix = `${DRAFT_PREFIX}${userId}:`
    const keys = Array.from({ length: window.localStorage.length }, (_, index) =>
      window.localStorage.key(index),
    ).filter((key): key is string => Boolean(key?.startsWith(prefix)))
    keys.forEach((key) => window.localStorage.removeItem(key))
  } catch {
    // Signing out must still complete when browser storage is unavailable.
  }
}
