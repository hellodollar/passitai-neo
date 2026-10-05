import { domainValues } from '@/generated/domain-values'
import type { PracticePaperItem, QuestionListItem } from '@/types/domain'
import {
  PRACTICE_RECORD_VERSION,
  type PracticeRecord,
  type PracticeRecordAnswer,
  type PracticeRecordContext,
  type PracticeRecordClearScope,
  type PracticeRecordIdentity,
  type PracticeRecordProgress,
} from '@/types/practice-record'
import {
  getPreviewOptions,
  getQuestionOptions,
  type PracticeAnswerRecord,
} from '@/utils/practice-question'
import {
  RECORD_PREFIX,
  LEGACY_DRAFT_PREFIX,
  practiceRecordKey as recordKey,
  legacyPracticeRecordKey as legacyKey,
  currentPracticeClearToken,
  isPracticeRecordCurrent,
  isLegacyPracticeRecordCleared,
  markPracticeRecordsCleared,
  notifyPracticeRecordChange,
} from '@/utils/practice-record-control'

const SOURCES = ['practice', 'favorites', 'wrong-questions'] as const
const SUBMISSION_ID_PATTERN = /^rec_[0-9a-f]{12}$/

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isRevision(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
}

function isStartedAt(value: unknown): value is number {
  return (
    typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Date.now() + 60_000
  )
}

function isSubmissionId(value: unknown): value is string {
  return typeof value === 'string' && SUBMISSION_ID_PATTERN.test(value)
}

function isPaperType(value: unknown): value is PracticeRecord['paperType'] {
  return value === null || domainValues.paperType.some((type) => type === value)
}

function parseAnswers(value: unknown): Record<string, PracticeRecordAnswer> {
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
            values: [...raw.values],
          },
        ],
      ]
    }),
  )
}

function sameAnswers(left: PracticeRecord['answers'], right: PracticeRecord['answers']) {
  const ids = Object.keys(left)
  return (
    ids.length === Object.keys(right).length &&
    ids.every((id) => {
      const a = left[id]!
      const b = right[id]
      return (
        b &&
        a.fingerprint === b.fingerprint &&
        a.text === b.text &&
        JSON.stringify([...a.values].sort()) === JSON.stringify([...b.values].sort())
      )
    })
  )
}

function parsePendingSubmission(
  value: unknown,
  revision: number,
): PracticeRecord['pendingSubmission'] {
  if (!isObject(value) || !isSubmissionId(value.submissionId) || value.answerRevision !== revision)
    return null
  // 旧版本没有请求快照，只保留 ID，等待题目加载后补齐。
  if (value.payload === null)
    return { submissionId: value.submissionId, answerRevision: revision, payload: null }
  const raw = value.payload
  if (
    !isObject(raw) ||
    raw.submissionId !== value.submissionId ||
    typeof raw.startTime !== 'string' ||
    !Number.isFinite(Date.parse(raw.startTime)) ||
    !isObject(raw.userAnswers)
  )
    return null
  const userAnswers: PracticeRecordProgress['submissionAnswers'] = {}
  for (const [id, answer] of Object.entries(raw.userAnswers)) {
    if (typeof answer === 'string') userAnswers[id] = answer
    else if (Array.isArray(answer) && answer.every((item) => typeof item === 'string'))
      userAnswers[id] = [...answer]
    else return null
  }
  return {
    submissionId: value.submissionId,
    answerRevision: revision,
    payload: { submissionId: value.submissionId, userAnswers, startTime: raw.startTime },
  }
}

function parseRecord(value: unknown, identity: PracticeRecordIdentity): PracticeRecord | null {
  if (
    !isObject(value) ||
    value.version !== PRACTICE_RECORD_VERSION ||
    value.userId !== identity.userId ||
    value.paperId !== identity.paperId ||
    value.source !== identity.source ||
    !SOURCES.includes(identity.source) ||
    typeof value.subjectId !== 'string' ||
    !isPaperType(value.paperType) ||
    !isStartedAt(value.startedAt) ||
    !isRevision(value.answerRevision)
  )
    return null
  let lastSubmission: PracticeRecord['lastSubmission'] = null
  const last = value.lastSubmission
  if (
    isObject(last) &&
    isSubmissionId(last.submissionId) &&
    isRevision(last.answerRevision) &&
    last.answerRevision <= value.answerRevision &&
    typeof last.submittedAt === 'string' &&
    Number.isFinite(Date.parse(last.submittedAt))
  ) {
    lastSubmission = {
      submissionId: last.submissionId,
      answerRevision: last.answerRevision,
      submittedAt: last.submittedAt,
    }
  }
  const answers = parseAnswers(value.answers)
  const lostAnswers =
    !isObject(value.answers) || Object.keys(answers).length !== Object.keys(value.answers).length
  return {
    ...identity,
    version: PRACTICE_RECORD_VERSION,
    clearToken: typeof value.clearToken === 'string' ? value.clearToken : '',
    subjectId: value.subjectId,
    paperType: value.paperType,
    startedAt: value.startedAt,
    currentQuestionId: typeof value.currentQuestionId === 'string' ? value.currentQuestionId : '',
    answers,
    inputs: parseAnswers(value.inputs),
    answerRevision: value.answerRevision + (lostAnswers ? 1 : 0),
    pendingSubmission: lostAnswers
      ? null
      : parsePendingSubmission(value.pendingSubmission, value.answerRevision),
    lastSubmission,
    savedAt:
      typeof value.savedAt === 'number' && Number.isFinite(value.savedAt) ? value.savedAt : 0,
  }
}

function parseStoredRecord(raw: string | null, identity: PracticeRecordIdentity) {
  try {
    const record = raw === null ? null : parseRecord(JSON.parse(raw), identity)
    return record && isPracticeRecordCurrent(record) ? record : null
  } catch {
    return null
  }
}

export function createPracticeRecord(
  context: PracticeRecordContext,
  now = Date.now(),
): PracticeRecord {
  let clearToken = ''
  try {
    clearToken = currentPracticeClearToken(context)
  } catch {
    // 存储不可用时仍允许作答，后续写入会返回失败。
  }
  return {
    ...context,
    version: PRACTICE_RECORD_VERSION,
    clearToken,
    startedAt: now,
    currentQuestionId: '',
    answers: {},
    inputs: {},
    answerRevision: 0,
    pendingSubmission: null,
    lastSubmission: null,
    savedAt: now,
  }
}

/** 新键写入并确认成功后才允许移除 v1，失败时继续保留旧草稿。 */
export function readPracticeRecord(context: PracticeRecordContext): PracticeRecord | null {
  try {
    const storage = window.localStorage
    const record = parseStoredRecord(storage.getItem(recordKey(context)), context)
    if (record) {
      const contextualRecord = {
        ...record,
        subjectId: context.subjectId,
        paperType: context.paperType,
      }
      return isPracticeRecordCurrent(contextualRecord) ? contextualRecord : null
    }
    // v1 没有分类和清理代际；已清理作用域内的旧草稿不能在延迟迁移时复活。
    if (isLegacyPracticeRecordCleared(context)) return null
    if (context.source !== 'practice') {
      const other = {
        ...context,
        source:
          context.source === 'favorites' ? ('wrong-questions' as const) : ('favorites' as const),
      }
      // 旧键删除失败时，已迁移到另一来源的记录也不能再复制一次。
      if (parseStoredRecord(storage.getItem(recordKey(other)), other)) return null
    }

    const oldKey = legacyKey(context)
    const raw = storage.getItem(oldKey)
    if (!raw) return null
    const legacy: unknown = JSON.parse(raw)
    if (
      !isObject(legacy) ||
      legacy.version !== 1 ||
      legacy.userId !== context.userId ||
      legacy.paperId !== context.paperId ||
      !isStartedAt(legacy.startedAt)
    )
      return null
    const answers = parseAnswers(legacy.answers)
    const revision = Object.keys(answers).length > 0 ? 1 : 0
    const migratedRecord: PracticeRecord = {
      ...createPracticeRecord(context, legacy.startedAt),
      currentQuestionId:
        typeof legacy.currentQuestionId === 'string' ? legacy.currentQuestionId : '',
      answers,
      inputs: parseAnswers(legacy.inputs),
      answerRevision: revision,
      pendingSubmission:
        isSubmissionId(legacy.pendingSubmissionId) &&
        isObject(legacy.answers) &&
        Object.keys(answers).length === Object.keys(legacy.answers).length
          ? { submissionId: legacy.pendingSubmissionId, answerRevision: revision, payload: null }
          : null,
      savedAt:
        typeof legacy.savedAt === 'number' && Number.isFinite(legacy.savedAt) ? legacy.savedAt : 0,
    }
    // v1 聚合训练没有来源，只归属首次打开的来源，不能复制给收藏和错题两边。
    if (writePracticeRecord(migratedRecord)) {
      try {
        if (storage.getItem(oldKey) === raw) storage.removeItem(oldKey)
      } catch {
        // 新记录已保存；删除旧键失败不会影响恢复，后续仍优先读取 v2。
      }
    }
    return migratedRecord
  } catch {
    return null
  }
}

export function writePracticeRecord(record: PracticeRecord) {
  try {
    if (!isPracticeRecordCurrent(record)) return false
    const key = recordKey(record)
    const value = JSON.stringify(record)
    window.localStorage.setItem(key, value)
    const saved = window.localStorage.getItem(key) === value
    if (!isPracticeRecordCurrent(record)) {
      if (window.localStorage.getItem(key) === value) window.localStorage.removeItem(key)
      return false
    }
    if (saved) notifyPracticeRecordChange()
    return saved
  } catch {
    return false
  }
}

/** 输入和位置可频繁保存；确认答案变化才递增版本，并为交卷记录固定请求快照。 */
export function updatePracticeRecord(
  record: PracticeRecord,
  progress: PracticeRecordProgress,
): PracticeRecord {
  const changed = !sameAnswers(record.answers, progress.answers)
  const answerRevision = record.answerRevision + (changed ? 1 : 0)
  const id = progress.pendingSubmissionId
  const existing = record.pendingSubmission
  const pendingSubmission =
    !id || (changed && existing?.submissionId === id)
      ? null
      : existing?.submissionId === id &&
          existing.answerRevision === answerRevision &&
          existing.payload
        ? existing
        : {
            submissionId: id,
            answerRevision,
            payload: {
              submissionId: id,
              userAnswers: Object.fromEntries(
                Object.entries(progress.submissionAnswers).map(([key, answer]) => [
                  key,
                  Array.isArray(answer) ? [...answer] : answer,
                ]),
              ),
              startTime: new Date(progress.startedAt).toISOString(),
            },
          }
  return {
    ...record,
    startedAt: progress.startedAt,
    currentQuestionId: progress.currentQuestionId,
    answers: parseAnswers(progress.answers),
    inputs: parseAnswers(progress.inputs),
    answerRevision,
    pendingSubmission,
    savedAt: Date.now(),
  }
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
  for (let index = 0; index < content.length; index++)
    hash = Math.imul(hash ^ content.charCodeAt(index), 16777619)
  return (hash >>> 0).toString(16).padStart(8, '0')
}

function restoreRecordAnswer(
  raw: PracticeRecordAnswer,
  question: QuestionListItem,
  fingerprint: string,
  confirmed: boolean,
): PracticeAnswerRecord | null {
  if (raw.fingerprint !== fingerprint) return null
  if (['single', 'multiple', 'judge'].includes(question.questionType)) {
    const options = getQuestionOptions(question)
    const allowed = new Set(
      (options.length > 0 ? options : getPreviewOptions(question.questionType)).map(
        (option) => option.value,
      ),
    )
    if (
      raw.values.some((value) => !allowed.has(value)) ||
      new Set(raw.values).size !== raw.values.length ||
      (question.questionType !== 'multiple' && raw.values.length > 1) ||
      (confirmed && raw.values.length === 0)
    )
      return null
  } else if (raw.values.length > 0 || (confirmed && !raw.text.trim())) return null
  return { questionId: question.id, text: raw.text, values: [...raw.values] }
}

/** 继续沿用题目指纹校验；题目变化会使当前答案版本和待提交快照失效。 */
export function restorePracticeRecord(
  record: PracticeRecord,
  questions: QuestionListItem[],
  fingerprints: Record<string, string>,
) {
  const answers: Record<string, PracticeAnswerRecord> = {}
  const storedAnswers: PracticeRecord['answers'] = {}
  const inputs: PracticeRecord['inputs'] = {}
  const byId = new Map(questions.map((question) => [question.id, question]))
  for (const [id, raw] of Object.entries(record.answers)) {
    const question = byId.get(id)
    if (!question) continue
    const answer = restoreRecordAnswer(raw, question, fingerprints[id] ?? '', true)
    if (answer) {
      answers[id] = answer
      storedAnswers[id] = raw
    }
  }
  for (const [id, raw] of Object.entries(record.inputs)) {
    const question = byId.get(id)
    if (
      question &&
      !answers[id] &&
      restoreRecordAnswer(raw, question, fingerprints[id] ?? '', false)
    )
      inputs[id] = raw
  }
  const index = questions.findIndex((question) => question.id === record.currentQuestionId)
  const currentIndex = index >= 0 ? index : 0
  const changed = !sameAnswers(record.answers, storedAnswers)
  const restoredRecord: PracticeRecord = {
    ...record,
    answers: storedAnswers,
    inputs,
    currentQuestionId: questions[currentIndex]?.id ?? '',
    answerRevision: record.answerRevision + (changed ? 1 : 0),
    pendingSubmission: changed ? null : record.pendingSubmission,
  }
  return { answers, inputs, currentIndex, record: restoredRecord }
}

export function removePracticeRecord(identity: PracticeRecordIdentity) {
  return clearPracticeRecords({ kind: 'paper', identity })
}

/** 登出同时清理 v2 和尚未访问、尚未迁移的 v1，且只处理当前账号。 */
export function clearUserPracticeRecords(userId: string) {
  if (clearPracticeRecords({ kind: 'all', userId })) return true
  // 登出不能被存储额度不足阻断；先尽力删除本账号数据，再尝试补写屏障。
  try {
    for (const key of storedUserKeys(userId)) window.localStorage.removeItem(key)
    try {
      markPracticeRecordsCleared({ kind: 'all', userId })
    } catch {
      // 浏览器完全禁止存储时仍允许退出。
    }
    notifyPracticeRecordChange()
    return true
  } catch {
    return false
  }
}

function storedUserKeys(userId: string) {
  const storage = window.localStorage
  const prefixes = [
    `${RECORD_PREFIX}${encodeURIComponent(userId)}:`,
    `${LEGACY_DRAFT_PREFIX}${userId}:`,
  ]
  return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
    (key): key is string => Boolean(key && prefixes.some((prefix) => key.startsWith(prefix))),
  )
}

/** 只读取当前用户的有效 v2 记录；不请求接口、不猜测旧草稿的分类。 */
export function listPracticeRecords(userId: string): PracticeRecord[] {
  try {
    return storedUserKeys(userId).flatMap((key) => {
      if (!key.startsWith(RECORD_PREFIX)) return []
      try {
        const raw: unknown = JSON.parse(window.localStorage.getItem(key) ?? '')
        if (
          !isObject(raw) ||
          typeof raw.paperId !== 'string' ||
          !SOURCES.includes(raw.source as PracticeRecord['source'])
        )
          return []
        const identity = {
          userId,
          paperId: raw.paperId,
          source: raw.source as PracticeRecord['source'],
        }
        if (key !== recordKey(identity)) return []
        const record = parseStoredRecord(JSON.stringify(raw), identity)
        return record ? [record] : []
      } catch {
        return []
      }
    })
  } catch {
    return []
  }
}

export function countLegacyPracticeRecords(userId: string) {
  try {
    return storedUserKeys(userId).filter((key) => key.startsWith(LEGACY_DRAFT_PREFIX)).length
  } catch {
    return 0
  }
}

/** 先持久化清理屏障，再移除数据；删除失败也不会恢复已清理的旧答案。 */
export function clearPracticeRecords(scope: PracticeRecordClearScope) {
  try {
    const storage = window.localStorage
    const userId = scope.kind === 'paper' ? scope.identity.userId : scope.userId
    const targets = storedUserKeys(userId)
      .filter((key) => {
        if (scope.kind === 'all') return true
        if (scope.kind === 'paper')
          return key === recordKey(scope.identity) || key === legacyKey(scope.identity)
        try {
          const raw: unknown = JSON.parse(storage.getItem(key) ?? '')
          return (
            key.startsWith(RECORD_PREFIX) &&
            isObject(raw) &&
            raw.userId === userId &&
            raw.source === 'practice' &&
            raw.paperType === scope.paperType
          )
        } catch {
          return false
        }
      })
      .map((key) => ({ key, value: storage.getItem(key) }))
    if (!markPracticeRecordsCleared(scope)) return false
    for (const { key, value } of targets) {
      try {
        // 其他标签页可能已在屏障之后开始新作答，不能删掉新代际数据。
        if (storage.getItem(key) === value) storage.removeItem(key)
      } catch {
        // 屏障已写入，残留的旧代际记录不再可读、可写。
      }
    }
    notifyPracticeRecordChange()
    return true
  } catch {
    return false
  }
}
