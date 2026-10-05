import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { getSwipeDirection } = await loadSource('composables/usePracticeNavigation.ts')

test('横滑切题，纵向滚动与短滑动不切题', () => {
  assert.equal(getSwipeDirection(-80, 8), 1)
  assert.equal(getSwipeDirection(80, 8), -1)
  assert.equal(getSwipeDirection(-40, 0), 0)
  assert.equal(getSwipeDirection(-80, 100), 0)
})
