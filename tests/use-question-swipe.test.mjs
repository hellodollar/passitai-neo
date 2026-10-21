import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { resolveSwipeAxis, dampedSwipeOffset, shouldCommitSwipe } = await loadSource(
  'composables/useQuestionSwipe.ts',
)

test('手势轴判定:横向位移足够才锁定,纵向滚动优先,锁定后不再改变', () => {
  assert.equal(resolveSwipeAxis(-20, 5, 'undecided'), 'horizontal')
  assert.equal(resolveSwipeAxis(20, 5, 'undecided'), 'horizontal')
  assert.equal(resolveSwipeAxis(-5, 20, 'undecided'), 'vertical')
  assert.equal(resolveSwipeAxis(-8, -8, 'undecided'), 'undecided')
  assert.equal(resolveSwipeAxis(0, 60, 'vertical'), 'vertical')
  assert.equal(resolveSwipeAxis(100, 0, 'horizontal'), 'horizontal')
})

test('拖拽位移:有相邻题时跟手,越界方向按 0.35 阻尼回弹', () => {
  assert.equal(dampedSwipeOffset(-100, true), -100)
  assert.equal(dampedSwipeOffset(-100, false), -35)
  assert.equal(dampedSwipeOffset(80, false), 28)
  assert.equal(dampedSwipeOffset(0.5, false), 0.5)
  assert.equal(dampedSwipeOffset(0, false), 0)
})

test('松手判定:距离过阈值或速度同向足够快才切题', () => {
  const width = 390
  // 距离超过 1/4 屏
  assert.equal(shouldCommitSwipe(-120, 0, width), 1)
  assert.equal(shouldCommitSwipe(120, 0, width), -1)
  // 距离不足且无速度:回弹
  assert.equal(shouldCommitSwipe(-60, 0, width), 0)
  // 快速轻拂:位移虽小但速度同向
  assert.equal(shouldCommitSwipe(-40, -1.2, width), 1)
  assert.equal(shouldCommitSwipe(40, 1.2, width), -1)
  // 速度与位移方向相反(回甩):不切
  assert.equal(shouldCommitSwipe(-40, 1.2, width), 0)
  // 位移过小,任何速度都不切
  assert.equal(shouldCommitSwipe(-10, -5, width), 0)
  // 舞台宽度为 0 时只按最小位移判定
  assert.equal(shouldCommitSwipe(-60, 0, 0), 1)
})
