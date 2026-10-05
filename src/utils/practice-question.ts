import type { PracticePaperItem, QuestionListItem, QuestionType } from '@/types/domain'

type RawQuestionOption =
  | string
  | {
      id?: string
      value?: string
      label?: string
      text?: string
      content?: string
      title?: string
      name?: string
    }

export type NormalizedQuestionOption = {
  label: string
  text: string
  value: string
}

export type RichQuestionListItem = QuestionListItem & {
  options?: RawQuestionOption[]
  choices?: RawQuestionOption[]
  optionList?: RawQuestionOption[]
  optionA?: string
  optionB?: string
  optionC?: string
  optionD?: string
  optionE?: string
  optionF?: string
  optionG?: string
  optionH?: string
  option1?: string
  option2?: string
  option3?: string
  option4?: string
  option5?: string
  option6?: string
  option7?: string
  option8?: string
  answer?: string | string[]
  correctAnswer?: string | string[]
  referenceAnswer?: string | string[]
  analysis?: string
  explanation?: string
}

export type PracticeAnswerRecord = {
  questionId: string
  text: string
  values: string[]
}

/** 把 API 题目转换为练习页使用的题目视图模型。 */
export function toQuestionListItem(item: PracticePaperItem, subjectId: string): QuestionListItem {
  const richQuestion: RichQuestionListItem = {
    id: item.id,
    subjectId,
    title: item.title,
    questionType: item.questionType as QuestionType,
    questionCategory: 'practice',
    status: 'enabled',
    createdBy: 'system',
    createdAt: '',
    optionA: item.A ?? undefined,
    optionB: item.B ?? undefined,
    optionC: item.C ?? undefined,
    optionD: item.D ?? undefined,
    optionE: item.E ?? undefined,
    optionF: item.F ?? undefined,
    correctAnswer: item.correctAnswer,
    explanation: item.explanation ?? undefined,
  }
  return richQuestion
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

function normalizeOption(option: RawQuestionOption, index: number): NormalizedQuestionOption | null {
  const fallbackLabel = OPTION_LETTERS[index] ?? String(index + 1)
  if (typeof option === 'string') {
    const parsedOption = parseOptionLine(option)
    return parsedOption ?? { label: fallbackLabel, text: option.trim(), value: fallbackLabel }
  }
  const rawText = String(
    option.text ?? option.content ?? option.title ?? option.name ?? option.value ?? '',
  )
  const parsedText = parseOptionLine(rawText)
  const label = option.label ? String(option.label).trim() : (parsedText?.label ?? fallbackLabel)
  const value = String(option.value ?? option.id ?? label)
  const text = parsedText && !option.label ? parsedText.text : rawText.trim()
  return text.trim() ? { label, text, value } : null
}

export function getQuestionOptions(question: QuestionListItem | undefined) {
  if (!question) return []
  const richQuestion = question as RichQuestionListItem
  const listedOptions = richQuestion.options ?? richQuestion.choices ?? richQuestion.optionList
  if (Array.isArray(listedOptions)) {
    const options = listedOptions
      .map((option, index) => normalizeOption(option, index))
      .filter((option): option is NormalizedQuestionOption => Boolean(option))
    if (options.length > 0) return uniqueOptions(options)
  }
  const letterOptions = [
    richQuestion.optionA,
    richQuestion.optionB,
    richQuestion.optionC,
    richQuestion.optionD,
    richQuestion.optionE,
    richQuestion.optionF,
    richQuestion.optionG,
    richQuestion.optionH,
  ]
    .map((option, index) => (option ? normalizeOption(option, index) : null))
    .filter((option): option is NormalizedQuestionOption => Boolean(option))
  if (letterOptions.length > 0) return uniqueOptions(letterOptions)
  const numberOptions = [
    richQuestion.option1,
    richQuestion.option2,
    richQuestion.option3,
    richQuestion.option4,
    richQuestion.option5,
    richQuestion.option6,
    richQuestion.option7,
    richQuestion.option8,
  ]
    .map((option, index) => (option ? normalizeOption(option, index) : null))
    .filter((option): option is NormalizedQuestionOption => Boolean(option))
  return numberOptions.length > 0 ? uniqueOptions(numberOptions) : parseQuestionTitle(question).options
}

function formatAnswerValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.join('、')
  return value ?? ''
}

function parseChoiceAnswerValues(value: string | string[] | undefined) {
  const tokens = formatAnswerValue(value)
    .trim()
    .toUpperCase()
    .split(/[\s,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
  return tokens.length === 1 && /^[A-H]{2,8}$/.test(tokens[0]!) ? [...tokens[0]!] : tokens
}

export function getReferenceAnswer(question: QuestionListItem | undefined) {
  if (!question) return ''
  const richQuestion = question as RichQuestionListItem
  return formatAnswerValue(
    richQuestion.correctAnswer ?? richQuestion.referenceAnswer ?? richQuestion.answer,
  )
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
  const isChoice = ['single', 'multiple', 'judge'].includes(question.questionType)
  const expectedValues = isChoice ? getCorrectOptionValues(question) : [reference.toUpperCase()]
  const actualValues = isChoice
    ? parseChoiceAnswerValues(record.values)
    : [record.text.trim().toUpperCase()]
  const expected = expectedValues.map((value) => value.toUpperCase()).sort().join(',')
  const actual = actualValues.map((value) => value.toUpperCase()).sort().join(',')
  return actual === expected
}
