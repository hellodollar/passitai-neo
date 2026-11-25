import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const {
  formatCollectedTimeText,
  parseCollectionFilters,
  parseHomeSelection,
  readBrowseState,
  writeBrowseState,
  clearBrowseState,
} = await loadSource('utils/browse/state.ts')

function storage() {
  const values = {}
  const target = {
    getItem: (key) => values[key] ?? null,
    setItem: (key, value) => {
      values[key] = value
      target[key] = value
    },
    removeItem: (key) => {
      delete values[key]
      delete target[key]
    },
  }
  return target
}

test('收藏、错题分别记住分组和排序，URL 优先，非法参数不进入请求', () => {
  global.window = { sessionStorage: storage() }
  writeBrowseState('filters', 'favorites', { groupBy: 'paper', sort: 'count', order: 'desc' })
  writeBrowseState('filters', 'mistakes', {
    groupBy: 'subject',
    sort: 'recent',
    order: 'asc',
  })
  const favorite = readBrowseState('filters', 'favorites')
  assert.deepEqual(parseCollectionFilters({}, favorite), {
    groupBy: 'paper',
    sort: 'count',
    order: 'desc',
  })
  assert.deepEqual(parseCollectionFilters({ groupBy: 'subject', order: 'asc' }, favorite), {
    groupBy: 'subject',
    sort: 'count',
    order: 'asc',
  })
  assert.equal(readBrowseState('filters', 'mistakes').order, 'asc')
  assert.deepEqual(parseCollectionFilters({ groupBy: ['paper'], sort: 'unknown', order: 'bad' }), {
    groupBy: 'subject',
    sort: 'recent',
    order: 'desc',
  })
})

test('首页保留科目、管理顺序和滚动位置，忽略旧题集筛选', () => {
  global.window = { sessionStorage: storage() }
  writeBrowseState('home', 'home', {
    subjectCode: 'GD-15044',
    scrollTop: 630,
    subjectOrder: ['GD-15044', 'GD-15043'],
    hiddenSubjectCodes: ['GD-15043'],
  })
  const state = readBrowseState('home', 'home')
  assert.deepEqual(parseHomeSelection({}, state), {
    subjectCode: 'GD-15044',
  })
  assert.deepEqual(
    parseHomeSelection(
      { subjectCode: 'GD-15043', paperType: 'errorTarget', paperPage: '3' },
      state,
    ),
    {
      subjectCode: 'GD-15043',
    },
  )
  assert.equal(state.scrollTop, 630)
  assert.deepEqual(state.subjectOrder, ['GD-15044', 'GD-15043'])
  assert.deepEqual(state.hiddenSubjectCodes, ['GD-15043'])
  assert.deepEqual(
    parseHomeSelection({ subjectCode: '../bad', paperType: ['aiPractice'], paperPage: -2 }),
    {
      subjectCode: '',
    },
  )
})

test('刷新可读取 sessionStorage，损坏状态和存储失败不阻断页面', () => {
  const store = storage()
  store.setItem(
    'passitai:browse:refresh:favorites',
    JSON.stringify({ groupBy: 'paper', sort: 'count', order: 'asc', scrollTop: 420 }),
  )
  store.setItem('passitai:browse:broken:home', '{broken')
  global.window = { sessionStorage: store }
  assert.equal(readBrowseState('refresh', 'favorites').scrollTop, 420)
  assert.equal(readBrowseState('broken', 'home').subjectCode, '')
  global.window = {
    sessionStorage: {
      getItem: () => {
        throw new Error('unavailable')
      },
      setItem: () => {
        throw new Error('unavailable')
      },
    },
  }
  assert.doesNotThrow(() => writeBrowseState('no-storage', 'favorites', { groupBy: 'paper' }))
  assert.equal(readBrowseState('no-storage', 'favorites').groupBy, 'paper')
  assert.equal(readBrowseState('', 'favorites').groupBy, 'subject')
})

test('账号隔离，登出只清除当前账号的页面记忆，不碰作答或其他账号', () => {
  const store = storage()
  global.window = { sessionStorage: store }
  writeBrowseState('account-a', 'favorites', { groupBy: 'paper' })
  writeBrowseState('account-b', 'favorites', { sort: 'count' })
  store.setItem('other-data', 'keep')
  clearBrowseState('account-a')
  assert.equal(readBrowseState('account-a', 'favorites').groupBy, 'subject')
  assert.equal(store.getItem('passitai:browse:account-a:favorites'), null)
  assert.equal(readBrowseState('account-b', 'favorites').sort, 'count')
  assert.equal(store.getItem('other-data'), 'keep')
})

test('收藏与错题时间按刚刚、今天、昨天、近 7 天、更早分档', () => {
  const now = new Date('2026-11-25T17:00:00+08:00')
  assert.equal(formatCollectedTimeText('2026-11-25T16:59:30+08:00', now), '刚刚')
  assert.equal(formatCollectedTimeText('2026-11-25T16:00:01+08:00', now), '刚刚')
  assert.equal(formatCollectedTimeText('2026-11-25T16:00:00+08:00', now), '今天')
  assert.equal(formatCollectedTimeText('2026-11-25T00:05:00+08:00', now), '今天')
  assert.equal(formatCollectedTimeText('2026-11-24T23:50:00+08:00', now), '昨天')
  assert.equal(formatCollectedTimeText('2026-11-20T12:00:00+08:00', now), '近 7 天')
  assert.equal(formatCollectedTimeText('2026-11-19T00:00:00+08:00', now), '近 7 天')
  assert.equal(formatCollectedTimeText('2026-11-18T23:59:59+08:00', now), '更早')
  assert.equal(formatCollectedTimeText('invalid-date', now), '')

  // 跨午夜但在 1 小时内仍展示“刚刚”
  const justAfterMidnight = new Date('2026-11-25T00:20:00+08:00')
  assert.equal(formatCollectedTimeText('2026-11-24T23:40:00+08:00', justAfterMidnight), '刚刚')
})
