import { addWrongQuestion, removeWrongQuestionByContext } from '@/api/wrong-questions'
import { useAuthStore } from '@/stores/auth'
import { usePracticeSettingsStore } from '@/stores/practiceSettings'
import type { CollectionContext, QuestionListItem } from '@/types/domain'
import type { PracticeAnswerRecord } from '@/types/practice-record'
import {
  getCorrectOptionValues,
  isAnswerCorrect,
  isChoiceQuestionType,
} from '@/utils/practice-question'
import { showErrorToast } from '@/utils/toast'

/** 答题后与服务端同步错题：答错收录、答对按设置移除；失败提示一次，不打断作答。 */
export function useWrongQuestionSync(options: {
  context: (questionId: string) => CollectionContext | null
}) {
  const auth = useAuthStore()
  const practiceSettings = usePracticeSettingsStore()
  let errorShown = false

  function showErrorOnce(message: string) {
    if (errorShown) return
    errorShown = true
    showErrorToast(message)
  }

  async function syncOnAnswered(question: QuestionListItem, record: PracticeAnswerRecord) {
    if (!isChoiceQuestionType(question.questionType)) return
    const correct = isAnswerCorrect(record, question)
    // 没有参考答案的选择题无法判分，既不收录也不移除。
    if (!correct && getCorrectOptionValues(question).length === 0) return

    const userId = auth.session?.user.id
    const settings = await practiceSettings.ensure()
    if (!userId || auth.session?.user.id !== userId) return

    const context = options.context(question.id)
    if (!context) return

    if (correct) {
      // 答对自动移除错题（幂等，无记录时静默）
      if (!settings?.removeMistakeOnCorrect) return
      try {
        await removeWrongQuestionByContext(context)
      } catch {
        // 静默失败：不打断答题流程
      }
      return
    }

    if (!settings) {
      showErrorOnce('刷题设置加载失败，错题未保存。')
      return
    }
    if (!settings.recordWrongQuestions) return

    try {
      await addWrongQuestion(context)
    } catch {
      showErrorOnce('错题记录失败，请稍后重试。')
    }
  }

  return { syncOnAnswered }
}
