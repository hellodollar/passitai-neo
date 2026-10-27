import { addMistake, removeMistakeByContext } from '@/api/mistakes'
import { useAuthStore } from '@/stores/auth'
import { usePracticeSettingsStore } from '@/stores/practice-settings'
import type { CollectionContext, PracticeAnswerRecord, QuestionListItem } from '@/types'
import {
  getCorrectOptionValues,
  isAnswerCorrect,
  isChoiceQuestionType,
} from '@/utils/practice/question'
import { showErrorToast } from '@/utils/toast'

/** 答题后与服务端同步错题：答错收录、答对按设置移除；失败提示一次，不打断作答。 */
export function useMistakeSync(options: {
  context: (questionId: string) => CollectionContext | null
  scopeKey: () => string
}) {
  const auth = useAuthStore()
  const practiceSettingsStore = usePracticeSettingsStore()
  let errorScope: string | undefined

  function showErrorOnce(message: string, scope: string) {
    if (errorScope === scope) return
    errorScope = scope
    showErrorToast(message)
  }

  async function syncOnAnswered(question: QuestionListItem, record: PracticeAnswerRecord) {
    if (!isChoiceQuestionType(question.questionType)) return
    const correct = isAnswerCorrect(record, question)
    // 没有参考答案的选择题无法判分，既不收录也不移除。
    if (!correct && getCorrectOptionValues(question).length === 0) return

    const userId = auth.session?.user.id
    const token = auth.session?.token
    const context = options.context(question.id)
    if (!userId || !context) return
    // 题目上下文与练习代际在等待设置前固定，避免同组件切换后提交到新题集。
    const answerContext = { ...context }
    const scope = options.scopeKey()
    const isCurrent = () =>
      options.scopeKey() === scope &&
      auth.session?.user.id === userId &&
      auth.session?.token === token
    const settings = await practiceSettingsStore.load()
    if (!isCurrent()) return

    if (correct) {
      // 答对自动移除错题（幂等，无记录时静默）
      if (!settings?.removeMistakeOnCorrect) return
      try {
        await removeMistakeByContext(answerContext)
      } catch {
        // 静默失败：不打断答题流程
      }
      return
    }

    if (!settings) {
      showErrorOnce('刷题设置加载失败，错题未保存。', scope)
      return
    }
    if (!settings.recordWrongQuestions) return

    try {
      await addMistake(answerContext)
    } catch {
      if (isCurrent()) showErrorOnce('错题记录失败，请稍后重试。', scope)
    }
  }

  return { syncOnAnswered }
}
