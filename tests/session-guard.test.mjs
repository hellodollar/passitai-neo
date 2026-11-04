import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import { loadSource } from './helpers/load-source.mjs'

const { createSessionGuard } = await loadSource('utils/session-guard.ts')
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

function setToken(token) {
  if (token === null) window.localStorage.removeItem(STORAGE_KEYS.authSession)
  else
    window.localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify({ token, user: {} }))
}

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), { localStorage: new MemoryStorage() })
  setToken('token-a')
})

test('同纪元同令牌:读取/写入守卫均通过', () => {
  const guard = createSessionGuard()
  const read = guard.captureRead()
  const write = guard.captureWrite()
  assert.equal(read(), true)
  assert.equal(write(), true)
})

test('reset 作废一切在途请求', () => {
  const guard = createSessionGuard()
  const read = guard.captureRead()
  const write = guard.captureWrite()
  guard.reset()
  assert.equal(read(), false)
  assert.equal(write(), false)
})

test('本地写入只作废读取守卫,不影响写入守卫', () => {
  const guard = createSessionGuard()
  const read = guard.captureRead()
  const write = guard.captureWrite()
  guard.noteWrite()
  assert.equal(read(), false)
  assert.equal(write(), true)
})

test('会话令牌切换作废所有守卫(登录新账号)', () => {
  const guard = createSessionGuard()
  const read = guard.captureRead()
  const write = guard.captureWrite()
  setToken('token-b')
  assert.equal(read(), false)
  assert.equal(write(), false)
})

test('reset 后新捕获的守卫恢复有效', () => {
  const guard = createSessionGuard()
  const stale = guard.captureRead()
  guard.reset()
  const fresh = guard.captureRead()
  assert.equal(stale(), false)
  assert.equal(fresh(), true)
})
