import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/**
 * 练习页键盘导航与自动切题。触摸横滑见 useQuestionSwipe;
 * 相邻切题经 move 钩子委托给横滑舞台,与手势共用同一条动画路径。
 */
export function usePracticeNavigation(options: {
  currentIndex: Ref<number>
  questionCount: () => number
  suspended: () => boolean
  /** 相邻切题钩子;返回 false(如动画进行中)时回退为直接改页码 */
  move?: (direction: -1 | 1) => boolean
}) {
  let autoAdvanceTimer: number | null = null

  function clearAutoAdvance() {
    if (autoAdvanceTimer === null) return
    window.clearTimeout(autoAdvanceTimer)
    autoAdvanceTimer = null
  }

  function nextQuestion() {
    if (options.currentIndex.value >= options.questionCount() - 1) return
    clearAutoAdvance()
    if (options.move?.(1)) return
    options.currentIndex.value++
  }

  function prevQuestion() {
    if (options.currentIndex.value <= 0) return
    clearAutoAdvance()
    if (options.move?.(-1)) return
    options.currentIndex.value--
  }

  /** 答对后短暂停留展示反馈,再自动切题;总观感 = 停留 + 横滑吸附动画(250ms) */
  const AUTO_ADVANCE_DELAY_MS = 300

  function scheduleAutoAdvance() {
    clearAutoAdvance()
    if (options.currentIndex.value >= options.questionCount() - 1) return
    autoAdvanceTimer = window.setTimeout(() => {
      autoAdvanceTimer = null
      if (!options.suspended()) nextQuestion()
    }, AUTO_ADVANCE_DELAY_MS)
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      options.suspended()
    ) {
      return
    }
    const target = event.target
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) {
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      nextQuestion()
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      prevQuestion()
    }
  }

  onMounted(() => window.addEventListener('keydown', handleKeydown))
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', handleKeydown)
    clearAutoAdvance()
  })

  return {
    clearAutoAdvance,
    nextQuestion,
    prevQuestion,
    scheduleAutoAdvance,
  }
}
