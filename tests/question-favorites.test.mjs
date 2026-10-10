import assert from 'node:assert/strict'
import test from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { useQuestionFavorites } = await loadSource('composables/useQuestionFavorites.ts')
const { preparePracticeSession } = await loadSource('utils/practice-session.ts')

const question = {
  id: 'qst_one',
  title: '题目',
  questionType: 'single',
  A: '一',
  B: '二',
  C: null,
  D: null,
  E: null,
  F: null,
  correctAnswer: 'A',
  explanation: null,
  subjectId: 'sub_one',
  paperId: 'pap_origin',
  favId: 'fav_old',
  wrongQuestionId: 'wrq_one',
}

function fixture({ collectionMode = true, items = [question], ids = [] } = {}) {
  const calls = []
  let scope = 'page:account1'
  let currentId = question.id
  const options = {
    questionId: () => currentId,
    collectionMode: () => collectionMode,
    context: (questionId) => {
      const item = items.find((item) => item.id === questionId)
      return item ? { questionId, subjectId: item.subjectId, paperId: item.paperId } : null
    },
    scopeKey: () => scope,
    add: async (context) => {
      calls.push(['add', context])
      return { favId: 'fav_new' }
    },
    remove: async (context) => {
      calls.push(['remove', context])
    },
    removeById: async (id) => {
      calls.push(['removeById', id])
    },
  }
  const controller = useQuestionFavorites(options)
  controller.resetFavorites(ids, items)
  return {
    controller,
    calls,
    options,
    changeScope: () => {
      scope = 'page:account2'
    },
    changeQuestion: (id) => {
      currentId = id
    },
  }
}

test('收藏聚合取消、重加、再次取消使用新 favId，保留原题集上下文', async () => {
  const { controller, calls } = fixture()
  await controller.toggleFavorite()
  assert.equal(controller.currentQuestionFavorited.value, false)
  await controller.toggleFavorite()
  assert.equal(controller.currentQuestionFavorited.value, true)
  await controller.toggleFavorite()
  assert.deepEqual(calls, [
    ['removeById', 'fav_old'],
    ['add', { questionId: 'qst_one', subjectId: 'sub_one', paperId: 'pap_origin' }],
    ['removeById', 'fav_new'],
  ])
  assert.equal(controller.currentQuestionFavorited.value, false)
})

test('普通刷题取消仍使用三元组，不改成 ID 删除', async () => {
  const { controller, calls } = fixture({
    collectionMode: false,
    items: [{ ...question, favId: null }],
    ids: ['qst_one'],
  })
  await controller.toggleFavorite()
  await controller.toggleFavorite()
  await controller.toggleFavorite()
  assert.equal(calls[0][0], 'remove')
  assert.equal(calls[2][0], 'remove')
  assert.deepEqual(calls[2][1], {
    questionId: 'qst_one',
    subjectId: 'sub_one',
    paperId: 'pap_origin',
  })
})

test('错题页从 favId 初始化状态，未收藏的题不能把 wrq ID 当收藏 ID', async () => {
  const known = fixture()
  assert.equal(known.controller.currentQuestionFavorited.value, true)
  await known.controller.toggleFavorite()
  assert.deepEqual(known.calls, [['removeById', 'fav_old']])
  const unknown = fixture({ items: [{ ...question, favId: null }] })
  assert.equal(unknown.controller.currentQuestionFavorited.value, false)
  await unknown.controller.toggleFavorite()
  await unknown.controller.toggleFavorite()
  assert.deepEqual(unknown.calls[1], ['removeById', 'fav_new'])
})

test('取消失败恢复收藏状态，重试仍使用有效 ID', async () => {
  const { controller, options, calls } = fixture()
  options.removeById = async () => {
    throw new Error('网络错误')
  }
  await controller.toggleFavorite()
  assert.equal(controller.currentQuestionFavorited.value, true)
  assert.ok(controller.favoriteError.value)
  options.removeById = async (id) => {
    calls.push(['retry', id])
  }
  await controller.toggleFavorite()
  assert.deepEqual(calls, [['retry', 'fav_old']])
  assert.equal(controller.favoriteError.value, '')
})

test('同题请求未完成不能重复切换，切到别题不影响原题处理', async () => {
  const { controller, options, changeQuestion } = fixture()
  let resolve
  let requests = 0
  options.removeById = () => {
    requests++
    return new Promise((done) => {
      resolve = done
    })
  }
  const pending = controller.toggleFavorite()
  await controller.toggleFavorite()
  assert.equal(requests, 1)
  assert.equal(controller.currentQuestionFavoritePending.value, true)
  changeQuestion('qst_other')
  resolve()
  await pending
  changeQuestion('qst_one')
  assert.equal(controller.currentQuestionFavoritePending.value, false)
  assert.equal(controller.currentQuestionFavorited.value, false)
})

test('换页或换账号后旧失败响应不能回滚到新页面', async () => {
  for (const reset of [true, false]) {
    const { controller, options, changeScope } = fixture()
    let reject
    options.removeById = () =>
      new Promise((_, fail) => {
        reject = fail
      })
    const pending = controller.toggleFavorite()
    if (reset) controller.resetFavorites()
    else changeScope()
    reject(new Error('迟到响应'))
    await pending
    assert.equal(controller.currentQuestionFavorited.value, false)
    assert.equal(controller.favoriteError.value, '')
  }
})

test('收藏成功迟到响应不能登记到新页面，缺少 favId 的响应不能伪报成功', async () => {
  const { controller, options } = fixture({ items: [{ ...question, favId: null }] })
  let resolve
  options.add = () =>
    new Promise((done) => {
      resolve = done
    })
  const pending = controller.toggleFavorite()
  controller.resetFavorites()
  resolve({ favId: 'fav_late' })
  await pending
  assert.equal(controller.currentQuestionFavorited.value, false)
  options.add = async () => null
  await controller.toggleFavorite()
  assert.equal(controller.currentQuestionFavorited.value, false)
  assert.ok(controller.favoriteError.value)
})

test('按科目无顶层 ID 的多题集聚合可以整理，逐题保留各自题集和 favId', () => {
  const second = { ...question, id: 'qst_two', paperId: 'pap_another', favId: 'fav_two' }
  const session = preparePracticeSession({
    name: '科目',
    subjectId: 'sub_one',
    questionCount: 2,
    sections: [{ name: '单选题', questionType: 'single', items: [question, second] }],
  })
  assert.equal(session.groups[0].key, 'sub_one-0')
  assert.equal(session.itemsById.get('qst_one').paperId, 'pap_origin')
  assert.equal(session.itemsById.get('qst_two').paperId, 'pap_another')
  assert.equal(session.itemsById.get('qst_two').favId, 'fav_two')
})
