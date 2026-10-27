import { onBeforeUnmount, ref, type Ref } from 'vue'

/**
 * 题目横滑切题。触摸逻辑独立于 usePracticeNavigation(键盘/自动切题):
 * 舞台渲染上一题/当前题/下一题三栏,拖拽时轨道跟手位移,松手按距离或速度
 * 决定切题或回弹,切题先动画滑到相邻题再提交页码,提交瞬间轨道已在新题位置,无闪跳。
 */

/** 手势轴:判定前不跟手,避免与纵向滚动抢手势 */
export type SwipeAxis = 'undecided' | 'horizontal' | 'vertical'

/** 判定为横向的最小位移(px),需大于常见点按抖动 */
const AXIS_LOCK_DISTANCE = 12
/** 横向/纵向的轴判定比例 */
const AXIS_RATIO = 1.2
/** 低于该位移不切题(px),过滤收尾抖动 */
const MIN_COMMIT_OFFSET = 24
/** 位移达到舞台宽度的该比例即可切题 */
const COMMIT_WIDTH_RATIO = 0.25
/** 快速轻拂的提交速度(px/ms),方向须与位移一致 */
const FLING_VELOCITY = 0.5
/** 松手吸附动画时长;JS 提交定时器略长于 CSS,避免抢在过渡结束前换题 */
const SETTLE_DURATION_MS = 250
const SETTLE_TIMER_MS = SETTLE_DURATION_MS + 20

/** 未锁定时按初始位移判定手势轴;已锁定后不再改变 */
export function resolveSwipeAxis(dx: number, dy: number, current: SwipeAxis): SwipeAxis {
  if (current !== 'undecided') return current
  if (Math.abs(dx) >= AXIS_LOCK_DISTANCE && Math.abs(dx) > Math.abs(dy) * AXIS_RATIO) {
    return 'horizontal'
  }
  if (Math.abs(dy) >= AXIS_LOCK_DISTANCE) return 'vertical'
  return 'undecided'
}

/** 无相邻题方向的拖拽用阻尼跟手,模拟拉到边的橡皮筋 */
export function dampedSwipeOffset(offset: number, hasNeighbor: boolean): number {
  if (hasNeighbor || Math.abs(offset) <= 1) return offset
  return Math.sign(offset) * Math.abs(offset) * 0.35
}

/** 松手判定:返回切题方向(1 下一题 / -1 上一题 / 0 回弹) */
export function shouldCommitSwipe(
  offset: number,
  velocity: number,
  stageWidth: number,
): -1 | 0 | 1 {
  if (Math.abs(offset) < MIN_COMMIT_OFFSET) return 0
  if (Math.abs(offset) >= stageWidth * COMMIT_WIDTH_RATIO) return offset < 0 ? 1 : -1
  if (Math.abs(velocity) >= FLING_VELOCITY && Math.sign(velocity) === Math.sign(offset)) {
    return offset < 0 ? 1 : -1
  }
  return 0
}

export function useQuestionSwipe(options: {
  index: Ref<number>
  count: () => number
  stageWidth: () => number
  suspended: () => boolean
}) {
  /** 舞台轨道当前位移(px),负值代表向下一题方向 */
  const dragOffset = ref(0)
  /** 吸附动画进行中,模板据此开启 CSS transition */
  const settling = ref(false)
  /** 答题卡跨题跳转时新题的入场方向(1 右进 / -1 左进 / 0 无) */
  const enterFrom = ref(0)

  let axis: SwipeAxis = 'undecided'
  let dragging = false
  let startX = 0
  let startY = 0
  let lastX = 0
  let lastTime = 0
  let lastOffset = 0
  let settleTimer: number | null = null
  let disposed = false

  function clearSettleTimer() {
    if (settleTimer !== null) {
      window.clearTimeout(settleTimer)
      settleTimer = null
    }
  }

  /** 动画滑到目标位移后回调换题,再无动画复位轨道(此时中心栏已是新题,视觉连续) */
  function settleTo(offset: number, onDone?: () => void) {
    settling.value = true
    dragOffset.value = offset
    clearSettleTimer()
    settleTimer = window.setTimeout(() => {
      settleTimer = null
      onDone?.()
      settling.value = false
      dragOffset.value = 0
    }, SETTLE_TIMER_MS)
  }

  /** 相邻切题统一走动画:手势提交、键盘方向键、自动切题共用 */
  function moveBy(direction: -1 | 1): boolean {
    if (disposed || settling.value || dragging) return false
    const target = options.index.value + direction
    if (target < 0 || target >= options.count()) return false
    const width = options.stageWidth()
    if (width <= 0) {
      options.index.value = target
      return true
    }
    settleTo(-direction * width, () => {
      options.index.value = target
    })
    return true
  }

  /** 答题卡任意跳题:相邻走动画;跨题直接切换并按方向轻量入场 */
  function jumpTo(target: number) {
    if (disposed || target === options.index.value) return
    if (target < 0 || target >= options.count()) return
    const direction = target > options.index.value ? 1 : -1
    if (Math.abs(target - options.index.value) === 1) {
      moveBy(direction)
      return
    }
    if (settling.value || dragging) reset()
    enterFrom.value = direction
    options.index.value = target
    window.setTimeout(() => {
      if (enterFrom.value === direction) enterFrom.value = 0
    }, 240)
  }

  /** 中断进行中的手势/动画并复位轨道(换卷、清除记录、账号切换时调用) */
  function reset() {
    dragging = false
    axis = 'undecided'
    clearSettleTimer()
    settling.value = false
    dragOffset.value = 0
    enterFrom.value = 0
  }

  function onTouchStart(event: TouchEvent) {
    axis = 'undecided'
    dragging = false
    const touch = event.touches[0]
    if (!touch) return
    startX = lastX = touch.clientX
    startY = touch.clientY
    lastTime = event.timeStamp
    lastOffset = 0
  }

  function onTouchMove(event: TouchEvent) {
    if (axis === 'vertical' || options.suspended() || settling.value) return
    const touch = event.touches[0]
    if (!touch) return
    const dx = touch.clientX - startX
    const dy = touch.clientY - startY
    axis = resolveSwipeAxis(dx, dy, axis)
    if (axis !== 'horizontal') return

    dragging = true
    const hasNeighbor = dx < 0 ? options.index.value < options.count() - 1 : options.index.value > 0
    lastOffset = dampedSwipeOffset(dx, hasNeighbor)
    dragOffset.value = lastOffset
    lastX = touch.clientX
    lastTime = event.timeStamp
  }

  function onTouchEnd(event: TouchEvent) {
    if (!dragging) {
      axis = 'undecided'
      return
    }
    dragging = false
    axis = 'undecided'
    const touch = event.changedTouches[0]
    const elapsed = event.timeStamp - lastTime
    const velocity = touch && elapsed > 0 ? (touch.clientX - lastX) / elapsed : 0
    let direction = shouldCommitSwipe(lastOffset, velocity, options.stageWidth())
    if (direction === 1 && options.index.value >= options.count() - 1) direction = 0
    if (direction === -1 && options.index.value <= 0) direction = 0
    if (direction === 0 || !moveBy(direction)) settleTo(0)
  }

  onBeforeUnmount(() => {
    disposed = true
    clearSettleTimer()
  })

  return {
    dragOffset,
    enterFrom,
    jumpTo,
    moveBy,
    onTouchEnd,
    onTouchMove,
    onTouchStart,
    reset,
    settling,
  }
}
