import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { formatProfileScore, summarizeRecentPracticeVolume, summarizeResourceTotals } =
  await loadSource('utils/practice/home-stats.ts')
const { fetchPracticeRecords } = await loadSource('api/practice.ts')

test('分数展示保留零分和满分，小数统一保留一位', () => {
  assert.equal(formatProfileScore(0), '0')
  assert.equal(formatProfileScore(100), '100')
  assert.equal(formatProfileScore(88), '88')
  assert.equal(formatProfileScore(88.24), '88.2')
})

test('题集与题量汇总按 paper.id 去重，避免跨槽位重复计数', () => {
  const totals = summarizeResourceTotals([
    {
      id: 'res1',
      name: '基准能力',
      type: 'baseline',
      list: [
        { id: 'pap1', questionCount: 100 },
        { id: 'pap2', questionCount: 50 },
      ],
    },
    {
      id: 'res2',
      name: '历年真题',
      type: 'pastExams',
      list: [
        { id: 'pap2', questionCount: 50 },
        { id: 'pap3', questionCount: 200 },
      ],
    },
  ])
  assert.deepEqual(totals, { paperCount: 3, questionCount: 350 })
})

test('今日、近 7 日与近 30 天累计练习按上海时区日历边界准确汇总', () => {
  const now = new Date('2026-11-27T10:00:00+08:00')
  const volume = summarizeRecentPracticeVolume(
    [
      // 今天凌晨（上海时区）-> 计入今日、近 7 日与近 30 天
      { answeredCount: 40, createdAt: '2026-11-26T16:30:00Z' },
      // 今天上午 -> 计入今日、近 7 日与近 30 天
      { answeredCount: 60, createdAt: '2026-11-27T09:15:00+08:00' },
      // 昨天 -> 计入近 7 日与近 30 天
      { answeredCount: 120, createdAt: '2026-11-26T23:50:00+08:00' },
      // 7 天前（超出 7 日窗口、在 30 天内）-> 只计入近 30 天
      { answeredCount: 50, createdAt: '2026-11-20T12:00:00+08:00' },
      // 29 天前（边界内）-> 只计入近 30 天
      { answeredCount: 80, createdAt: '2026-10-29T08:00:00+08:00' },
      // 30 天前（超出 30 天窗口）-> 不计入
      { answeredCount: 500, createdAt: '2026-10-28T23:59:00+08:00' },
      // 非法时间忽略
      { answeredCount: 99, createdAt: 'invalid' },
    ],
    now,
  )
  assert.deepEqual(volume, { todayAnswered: 100, weeklyAnswered: 220, monthlyAnswered: 350 })
})

test('fetchPracticeRecords 正确拼接科目、分页参数并透传 AbortSignal', async () => {
  const previousFetch = globalThis.fetch
  const calls = []
  const controller = new AbortController()
  globalThis.fetch = async (url, init = {}) => {
    const target = new URL(String(url), 'https://fixture.invalid')
    calls.push({ pathname: target.pathname, search: target.search, signal: init.signal })
    return new Response(
      JSON.stringify({
        ok: true,
        data: {
          total: 1,
          items: [{ id: 'rec000000000001', paperId: 'pap1', answeredCount: 20 }],
        },
      }),
      { headers: { 'content-type': 'application/json' } },
    )
  }
  try {
    const res = await fetchPracticeRecords(
      { subjectCode: 'GD-15043', page: 1, limit: 50 },
      controller.signal,
    )
    assert.equal(res.total, 1)
    assert.equal(calls[0].pathname, '/api/practice/records')
    assert.equal(calls[0].search, '?subjectCode=GD-15043&page=1&limit=50')
    assert.equal(calls[0].signal, controller.signal)
  } finally {
    globalThis.fetch = previousFetch
  }
})
