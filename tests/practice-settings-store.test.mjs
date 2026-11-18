import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { createPinia, setActivePinia } from 'pinia'

import { loadSource } from './helpers/load-source.mjs'

const { STORAGE_KEYS } = await loadSource('constants/app.ts')
const { useAuthStore } = await loadSource('stores/auth.ts')
const {
  DEFAULT_PRACTICE_SETTINGS,
  normalizePracticeSettings,
  practiceSettingsStorageKey,
  usePracticeSettingsStore,
} = await loadSource('stores/practice-settings.ts')

class MemoryStorage {
  items = new Map()
  get length() {
    return this.items.size
  }
  key(index) {
    return [...this.items.keys()][index] ?? null
  }
  getItem(key) {
    return this.items.get(key) ?? null
  }
  setItem(key, value) {
    this.items.set(key, String(value))
  }
  removeItem(key) {
    this.items.delete(key)
  }
}

function setSession(userId) {
  const session = userId
    ? {
        token: `token-${userId}`,
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(),
        user: {
          id: userId,
          email: `${userId}@example.com`,
          role: 'user',
          status: 'enabled',
          createdAt: '2026-01-01T00:00:00Z',
        },
      }
    : null
  if (session) {
    window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(session))
  } else {
    window.localStorage.removeItem(STORAGE_KEYS.authSession)
  }
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { localStorage: new MemoryStorage() })
  setActivePinia(createPinia())
})

test('未设置或数据损坏时回退默认刷题设置', () => {
  assert.deepEqual(normalizePracticeSettings(null), DEFAULT_PRACTICE_SETTINGS)
  assert.deepEqual(normalizePracticeSettings({ autoNext: 'yes', shuffleQuestions: true }), {
    ...DEFAULT_PRACTICE_SETTINGS,
    shuffleQuestions: true,
  })
})

test('刷题设置按用户 ID 本地持久化，不发网络请求', () => {
  setSession('user-a')
  const store = usePracticeSettingsStore()
  assert.deepEqual(store.settings, DEFAULT_PRACTICE_SETTINGS)

  const updated = store.save({ autoNext: true, autoSubmitAfterCompletion: true })
  assert.equal(updated.autoNext, true)
  assert.equal(updated.autoSubmitAfterCompletion, true)
  assert.equal(store.settings.autoNext, true)
  assert.deepEqual(
    JSON.parse(window.localStorage.getItem(practiceSettingsStorageKey('user-a'))),
    updated,
  )
})

test('用户登出不清理本地刷题设置，再次登录同账号直接恢复', () => {
  setSession('user-a')
  const auth = useAuthStore()
  const store = usePracticeSettingsStore()
  store.save({ shuffleQuestions: true, autoNext: true })

  auth.clearSession()
  assert.ok(
    window.localStorage.getItem(practiceSettingsStorageKey('user-a')),
    '登出后本地刷题设置仍保留',
  )
  assert.deepEqual(store.settings, DEFAULT_PRACTICE_SETTINGS)

  setSession('user-a')
  store.load()
  assert.equal(store.settings.shuffleQuestions, true)
  assert.equal(store.settings.autoNext, true)
})

test('不同账号隔离各自的本地刷题设置', () => {
  setSession('user-a')
  const store = usePracticeSettingsStore()
  store.save({ autoNext: true, recordWrongQuestions: false })

  setSession('user-b')
  store.load()
  assert.equal(store.settings.autoNext, false)
  assert.equal(store.settings.recordWrongQuestions, true)
  store.save({ shuffleQuestions: true })

  setSession('user-a')
  store.load()
  assert.equal(store.settings.autoNext, true)
  assert.equal(store.settings.recordWrongQuestions, false)
  assert.equal(store.settings.shuffleQuestions, false)
})
