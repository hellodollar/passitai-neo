import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { fetchPracticeContent } = await loadSource('api/practice-content.ts')
const { preparePracticePaper } = await loadSource('utils/practice/paper.ts')
const previousFetch = globalThis.fetch
let requests, respond

beforeEach(() => {
  requests = []
  globalThis.fetch = async (url) => {
    const target = new URL(String(url), 'https://fixture.invalid')
    requests.push(target)
    return new Response(JSON.stringify({ ok: true, data: respond(target) }), {
      headers: { 'content-type': 'application/json' },
    })
  }
})
afterEach(() => {
  globalThis.fetch = previousFetch
})

test('普通题集从新版接口读取，保留真实来源，缺少答案时不伪造判分', async () => {
  respond = (url) => {
    if (url.pathname === '/api/subjects/GD-13811') return { id: 'sub-one' }
    assert.equal(url.pathname, '/api/practice/papers/pap-one')
    return {
      id: 'pap-one',
      name: '考点通练',
      subjectCode: 'GD-13811',
      type: 'pointCoverage',
      questionCount: 1,
      sections: [
        {
          name: '单选题',
          questionType: 'single',
          items: [{ id: 'que-one', title: '问题', type: 'single', A: '选项一', B: '选项二' }],
        },
      ],
    }
  }
  const loaded = await fetchPracticeContent({ source: 'practice', paperId: 'pap-one' })
  assert.deepEqual(
    requests.map((url) => url.pathname),
    ['/api/practice/papers/pap-one', '/api/subjects/GD-13811'],
  )
  assert.equal(loaded.canSubmit, false)
  const prepared = preparePracticePaper(loaded.paper)
  assert.equal(prepared.questions[0].subjectId, 'sub-one')
  assert.equal(prepared.itemsById.get('que-one').paperId, 'pap-one')
  assert.equal(prepared.questions[0].correctAnswer, '')
  assert.equal(prepared.questions[0].explanation, null)
})

for (const source of ['favorites', 'mistakes']) {
  for (const groupBy of ['subject', 'paper']) {
    test(`${source} 按 ${groupBy} 进入时保留分组及每题真实来源`, async () => {
      const paper = {
        name: '集合练习',
        subjectId: 'sub-one',
        questionCount: 1,
        sections: [
          {
            name: '单选题',
            items: [
              {
                id: 'que-one',
                paperId: 'pap-origin',
                subjectId: 'sub-one',
                questionType: 'single',
                correctAnswer: 'A',
                explanation: '解析',
                favId: 'fav-one',
                mistakeId: 'mistake-one',
              },
            ],
          },
        ],
      }
      respond = (url) => {
        assert.equal(url.pathname, `/api/${source}/practice`)
        assert.deepEqual([...url.searchParams], [[`${groupBy}Id`, 'resource-one']])
        return { paper }
      }
      const loaded = await fetchPracticeContent({ source, groupBy, groupId: 'resource-one' })
      assert.deepEqual(loaded.paper, paper)
      assert.equal(loaded.canSubmit, false)
      assert.equal(requests.length, 1)
    })
  }
}
