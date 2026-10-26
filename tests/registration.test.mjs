import assert from 'node:assert/strict'
import { afterEach, beforeEach, test } from 'node:test'
import { loadSource } from './helpers/load-source.mjs'

const { inviteCodeError, normalizeInviteCode, registrationPayload } =
  await loadSource('utils/registration.ts')
const { register } = await loadSource('api/auth.ts')
const previousFetch = globalThis.fetch
const previousWindow = globalThis.window
let handler
let calls

beforeEach(() => {
  globalThis.window = Object.assign(new EventTarget(), {
    localStorage: {
      getItem() {
        return null
      },
    },
  })
  calls = []
  handler = () =>
    new Response(JSON.stringify({ ok: true, data: {} }), {
      headers: { 'content-type': 'application/json' },
    })
  globalThis.fetch = (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) })
    return handler()
  }
})
afterEach(() => {
  globalThis.fetch = previousFetch
  globalThis.window = previousWindow
})

test('邀请码选填，填写时规范为六位大小写无关字母数字', () => {
  assert.equal(inviteCodeError(''), '')
  assert.equal(inviteCodeError('   '), '')
  assert.equal(normalizeInviteCode('  ab12c3  '), 'AB12C3')
  assert.equal(inviteCodeError('  ab12c3  '), '')
  for (const value of ['ABCDEF', '123456', 'AB123', 'AB12345', 'AB-123', 'AB 123']) {
    assert.ok(inviteCodeError(value))
  }
})

test('空邀请码不提交字段，非空规范化且密码不变', () => {
  const input = { email: ' user@example.invalid ', password: '  Pass123  ' }
  for (const inviteCode of [undefined, '', '   ']) {
    assert.deepEqual(registrationPayload({ ...input, inviteCode }), {
      email: 'user@example.invalid',
      password: '  Pass123  ',
    })
  }
  assert.deepEqual(registrationPayload({ ...input, inviteCode: ' ab12c3 ' }), {
    email: 'user@example.invalid',
    password: '  Pass123  ',
    inviteCode: 'AB12C3',
  })
})

test('注册直接提交，没有策略预读；空邀请码也可提交', async () => {
  await register(registrationPayload({ email: 'user@example.invalid', password: 'Pass123' }))
  assert.deepEqual(calls, [
    {
      url: '/api/register',
      body: { email: 'user@example.invalid', password: 'Pass123' },
    },
  ])
})

test('服务端决定限邀和注册开关，400/403 保留为接口错误', async () => {
  for (const status of [400, 403]) {
    handler = () =>
      new Response(
        JSON.stringify({
          ok: false,
          message: status === 400 ? '邀请码无效' : '注册暂未开放',
          data: null,
        }),
        { status, headers: { 'content-type': 'application/json' } },
      )
    await assert.rejects(
      register({ email: 'user@example.invalid', password: 'Pass123' }),
      (error) => error.status === status,
    )
  }
})
