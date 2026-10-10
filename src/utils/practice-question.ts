import type { PracticePaperItem, QuestionListItem, QuestionType } from '@/types/domain'
import type { PracticeAnswerRecord } from '@/types/practice-record'

export type NormalizedQuestionOption = {
  label: string
  text: string
  value: string
}

/** 把 API 题目转换为练习页使用的题目视图模型。 */
export function toQuestionListItem(item: PracticePaperItem, subjectId: string): QuestionListItem {
  return {
    id: item.id,
    subjectId,
    title: item.title,
    questionType: item.questionType,
    A: item.A,
    B: item.B,
    C: item.C,
    D: item.D,
    E: item.E,
    F: item.F,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation,
  }
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H']

function parseOptionLine(line: string): NormalizedQuestionOption | null {
  const match = line.trim().match(/^([A-Ha-h])\s*[.\u3001)\uff09:：]\s*(.+)$/)
  if (!match?.[1] || !match?.[2]?.trim()) return null
  const label = match[1].toUpperCase()
  return { label, text: match[2].trim(), value: label }
}

function uniqueOptions(options: NormalizedQuestionOption[]) {
  const seen = new Set<string>()
  return options.filter((option) => {
    const key = option.value || option.label
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function getPreviewOptions(questionType: QuestionType | undefined): NormalizedQuestionOption[] {
  if (questionType === 'judge') {
    return [
      { label: 'A', text: '正确', value: 'A' },
      { label: 'B', text: '错误', value: 'B' },
    ]
  }
  if (questionType === 'single' || questionType === 'multiple') {
    return ['选项 A', '选项 B', '选项 C', '选项 D'].map((text, index) => {
      const label = OPTION_LETTERS[index]!
      return { label, text, value: label }
    })
  }
  return []
}

export function parseQuestionTitle(question: QuestionListItem | undefined) {
  const title = question?.title.trim() ?? ''
  if (!title) return { title: '', options: [] as NormalizedQuestionOption[] }
  const lines = title.split(/\r?\n/)
  const parsedOptions = uniqueOptions(
    lines
      .map((line) => parseOptionLine(line))
      .filter((option): option is NormalizedQuestionOption => Boolean(option)),
  )
  if (parsedOptions.length < 2) return { title, options: [] as NormalizedQuestionOption[] }
  const firstOptionIndex = lines.findIndex((line) => Boolean(parseOptionLine(line)))
  const titleLines = firstOptionIndex >= 0 ? lines.slice(0, firstOptionIndex) : lines
  return { title: titleLines.join('\n').trim() || title, options: parsedOptions }
}

function normalizeOption(option: string, index: number): NormalizedQuestionOption | null {
  const fallbackLabel = OPTION_LETTERS[index] ?? String(index + 1)
  const parsed = parseOptionLine(option)
  if (parsed) return parsed
  const text = option.trim()
  return text ? { label: fallbackLabel, text, value: fallbackLabel } : null
}

export function getQuestionOptions(question: QuestionListItem | undefined) {
  if (!question) return []
  const letterOptions = [
    question.A,
    question.B,
    question.C,
    question.D,
    question.E,
    question.F,
  ]
    .map((option, index) => (option ? normalizeOption(option, index) : null))
    .filter((option): option is NormalizedQuestionOption => Boolean(option))
  return letterOptions.length > 0 ? uniqueOptions(letterOptions) : parseQuestionTitle(question).options
}

function parseChoiceAnswerValues(value: string | string[]) {
  const tokens = (Array.isArray(value) ? value.join('、') : value)
    .trim()
    .toUpperCase()
    .split(/[\s,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
  return tokens.length === 1 && /^[A-H]{2,8}$/.test(tokens[0]!) ? [...tokens[0]!] : tokens
}

export function getReferenceAnswer(question: QuestionListItem | undefined) {
  return question?.correctAnswer ?? ''
}

/** 选择题（单选/多选/判断）可本地判分；其余题型交卷后待服务端批阅。 */
export function isChoiceQuestionType(type: QuestionType | undefined): boolean {
  return type === 'single' || type === 'multiple' || type === 'judge'
}

export function getCorrectOptionValues(
  question: QuestionListItem | undefined,
  options = getQuestionOptions(question),
) {
  if (!question) return []
  const expectedValues = new Set(parseChoiceAnswerValues(getReferenceAnswer(question)))
  if (question.questionType === 'judge') {
    if (expectedValues.has('TRUE') || expectedValues.has('正确')) expectedValues.add('A')
    if (expectedValues.has('FALSE') || expectedValues.has('错误')) expectedValues.add('B')
  }
  const availableOptions = options.length > 0 ? options : getPreviewOptions(question.questionType)
  return availableOptions
    .filter((option) =>
      [option.value, option.label, option.text].some((value) =>
        expectedValues.has(value.trim().toUpperCase()),
      ),
    )
    .map((option) => option.value)
}

export function isAnswerCorrect(record: PracticeAnswerRecord, question: QuestionListItem) {
  const reference = getReferenceAnswer(question).trim()
  if (!reference) return false
  const isChoice = isChoiceQuestionType(question.questionType)
  const expectedValues = isChoice ? getCorrectOptionValues(question) : [reference.toUpperCase()]
  const actualValues = isChoice
    ? parseChoiceAnswerValues(record.values)
    : [record.text.trim().toUpperCase()]
  const expected = expectedValues.map((value) => value.toUpperCase()).sort().join(',')
  const actual = actualValues.map((value) => value.toUpperCase()).sort().join(',')
  return actual === expected
}
