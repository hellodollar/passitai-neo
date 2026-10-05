import { onBeforeUnmount, onMounted, type Ref } from 'vue'

/** 横向位移足够明显时才切题，避免与页面纵向滚动冲突。 */
export function getSwipeDirection(deltaX: number, deltaY: number): -1 | 0 | 1 {
  if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.3) return 0
  return deltaX < 0 ? 1 : -1
}

export function usePracticeNavigation(options: {
  currentIndex: Ref<number>
  questionCount: () => number
  suspended: () => boolean
}) {
  let touchStartX = 0
  let touchStartY = 0
  let autoAdvanceTimer: number | null = null

  function clearAutoAdvance() {
    if (autoAdvanceTimer === null) return
    window.clearTimeout(autoAdvanceTimer)
    autoAdvanceTimer = null
  }

  function nextQuestion() {
    if (options.currentIndex.value >= options.questionCount() - 1) return
    clearAutoAdvance()
    options.currentIndex.value++
  }

  function prevQuestion() {
    if (options.currentIndex.value <= 0) return
    clearAutoAdvance()
    options.currentIndex.value--
  }

  function scheduleAutoAdvance() {
    clearAutoAdvance()
    if (options.currentIndex.value >= options.questionCount() - 1) return
    autoAdvanceTimer = window.setTimeout(() => {
      autoAdvanceTimer = null
      if (!options.suspended()) nextQuestion()
    }, 800)
  }

  function handleTouchStart(event: TouchEvent) {
    const touch = event.touches[0]
    if (!touch) return
    touchStartX = touch.clientX
    touchStartY = touch.clientY
  }

  function handleTouchEnd(event: TouchEvent) {
    const touch = event.changedTouches[0]
    if (!touch || options.suspended()) return
    const direction = getSwipeDirection(touch.clientX - touchStartX, touch.clientY - touchStartY)
    if (direction === 1) nextQuestion()
    else if (direction === -1) prevQuestion()
  }

  function handleKeydown(event: KeyboardEvent) {
    if (
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      options.suspended()
    ) return
    const target = event.target
    if (
      target instanceof HTMLElement &&
      (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    ) return

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
    handleTouchEnd,
    handleTouchStart,
    nextQuestion,
    prevQuestion,
    scheduleAutoAdvance,
  }
}
