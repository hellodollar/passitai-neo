import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { normalizeAppearance, resolveThemeName, initializeAppearance, useAppearance } =
  await loadSource('composables/useAppearance.ts')
const { STORAGE_KEYS } = await loadSource('constants/app.ts')

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

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { localStorage: new MemoryStorage() })
})

test('偏好归一化:合法值透传,历史值与非法值回退跟随系统', () => {
  assert.equal(normalizeAppearance('system'), 'system')
  assert.equal(normalizeAppearance('light'), 'light')
  assert.equal(normalizeAppearance('dark'), 'dark')
  assert.equal(normalizeAppearance('neo'), 'system')
  assert.equal(normalizeAppearance(null), 'system')
  assert.equal(normalizeAppearance(''), 'system')
  assert.equal(normalizeAppearance(undefined), 'system')
})

test('主题解析:手动档直接映射,系统档按系统深浅', () => {
  assert.equal(resolveThemeName('light', true), 'neo')
  assert.equal(resolveThemeName('light', false), 'neo')
  assert.equal(resolveThemeName('dark', true), 'neo-dark')
  assert.equal(resolveThemeName('dark', false), 'neo-dark')
  assert.equal(resolveThemeName('system', true), 'neo-dark')
  assert.equal(resolveThemeName('system', false), 'neo')
})

test('启动读取本地偏好,切换即时写入并归一化非法值', () => {
  window.localStorage.setItem(STORAGE_KEYS.appearance, 'dark')
  initializeAppearance()
  const { appearance, setAppearance } = useAppearance()
  assert.equal(appearance.value, 'dark')

  setAppearance('light')
  assert.equal(appearance.value, 'light')
  assert.equal(window.localStorage.getItem(STORAGE_KEYS.appearance), 'light')

  // 历史值按跟随系统处理,不写入非法内容
  setAppearance('neo')
  assert.equal(appearance.value, 'system')
  assert.equal(window.localStorage.getItem(STORAGE_KEYS.appearance), 'system')
})
