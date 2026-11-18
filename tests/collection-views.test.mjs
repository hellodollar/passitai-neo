import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, test } from 'node:test'

import ts from 'typescript'
import * as vue from 'vue'
import { compileScript, parse } from 'vue/compiler-sfc'

import { loadSource } from './helpers/load-source.mjs'

const { COLLECTION_SORT_OPTIONS } = await loadSource('constants/collection.ts')
const { formatCollectedTimeText, parseCollectionFilters } =
  await loadSource('utils/browse/state.ts')
let auth, route, calls, requests, app, pushes
const dependencies = {
  vue,
  'vue-router': {
    useRoute: () => route,
    useRouter: () => ({
      replace: async () => {},
      resolve: () => ({ fullPath: `${route.path}?groupBy=subject&sort=recent&order=desc` }),
      push: (location) => pushes.push(location),
    }),
  },
  '@lucide/vue': {},
  '@/api/favorites': { fetchFavoriteGroups: (query) => fetchGroups('favorites', query) },
  '@/api/mistakes': { fetchMistakeGroups: (query) => fetchGroups('mistakes', query) },
  '@/components/common/EmptyState.vue': {},
  '@/components/common/PageContainer.vue': {},
  '@/components/common/PagePlaceholder.vue': {},
  '@/components/common/SortMenu.vue': {},
  '@/composables/useBrowseScroll': {
    useBrowseScroll: () => ({ reset() {}, restore: async () => {} }),
  },
  '@/constants/collection': { COLLECTION_SORT_OPTIONS },
  '@/stores/auth': { useAuthStore: () => auth },
  '@/utils/browse/state': {
    formatCollectedTimeText,
    parseCollectionFilters,
    readBrowseState: () => ({}),
    writeBrowseState() {},
  },
}

function fetchGroups(source, query) {
  calls.push({ source, query })
  return new Promise((resolve, reject) => requests.push({ source, resolve, reject }))
}

function loadView(source, name) {
  const { descriptor } = parse(
    readFileSync(new URL(`../src/views/${source}/${name}View.vue`, import.meta.url), 'utf8'),
  )
  const script = compileScript(descriptor, { id: `${source}-view-test` })
  const { outputText } = ts.transpileModule(script.content, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  })
  const module = { exports: {} }
  new Function('require', 'module', 'exports', outputText)(
    (name) => {
      assert.ok(name in dependencies, `Unexpected dependency ${name}`)
      return dependencies[name]
    },
    module,
    module.exports,
  )
  return { ...module.exports.default, render: () => null }
}
const views = {
  favorites: loadView('favorites', 'Favorites'),
  mistakes: loadView('mistakes', 'Mistakes'),
}
const renderer = vue.createRenderer({
  createComment: () => ({}),
  insert: (node, parent) => (node.parent = parent),
  remove() {},
  parentNode: (node) => node.parent,
  nextSibling: () => null,
})

function mount(source) {
  route.path = `/${source}`
  app = renderer.createApp(views[source])
  app.mount({})
  return app._instance.setupState
}

const flush = async () => {
  await new Promise((resolve) => setImmediate(resolve))
  await vue.nextTick()
}
const result = (name) => ({
  items: [{ subjectId: name, subjectName: name, questionCount: 2, lastCollectedAt: '2026-11-18' }],
})

beforeEach(() => {
  calls = []
  pushes = []
  requests = []
  auth = vue.reactive({
    isAuthenticated: true,
    session: { token: 'first-token', user: { id: 'first-user' } },
  })
  route = vue.reactive({ query: {}, path: '/favorites' })
})
afterEach(() => app?.unmount())

for (const source of ['favorites', 'mistakes']) {
  test(`${source} 列表只调用自己的接口，并进入同一作答页`, async () => {
    const state = mount(source)
    assert.deepEqual(
      calls.map((call) => call.source),
      [source],
    )
    requests[0].resolve(result('subject-one'))
    await flush()
    state.openPractice(state.items[0])
    assert.deepEqual(pushes[0], {
      name: `${source}-practice`,
      params: { groupBy: 'subject', groupId: 'subject-one' },
      query: {
        subjectName: 'subject-one',
        returnTo: `/${source}?groupBy=subject&sort=recent&order=desc`,
      },
    })
  })

  test(`${source} 切换账号后清空旧列表，旧账号响应不能写回新会话`, async () => {
    const state = mount(source)
    auth.session = { token: 'second-token', user: { id: 'second-user' } }
    await vue.nextTick()
    requests[0].resolve(result('first-user'))
    await flush()
    assert.deepEqual(state.items, [])
    requests[1].resolve(result('second-user'))
    await flush()
    assert.equal(state.items[0].subjectName, 'second-user')
  })

  test(`${source} 离页后忽略尚未完成的请求`, async () => {
    const state = mount(source)
    app.unmount()
    app = null
    requests[0].resolve(result('late'))
    await flush()
    assert.deepEqual(state.items, [])
  })

  test(`${source} 分组加载失败时保留原列表及其分组`, async () => {
    const state = mount(source)
    requests[0].resolve(result('subject-one'))
    await flush()
    state.selectGroupMode('paper')
    assert.equal(calls.at(-1).query.groupBy, 'paper')
    requests[1].reject(new Error('offline'))
    await flush()
    assert.equal(state.groupMode, 'subject')
    assert.equal(state.displayedGroupMode, 'subject')
    assert.equal(state.items[0].subjectId, 'subject-one')
    assert.equal(state.loadError, true)
  })
}
