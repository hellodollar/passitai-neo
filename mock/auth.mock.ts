import { defineMock } from 'vite-plugin-mock-dev-server'

import { ApiCode, fail, mockAccount, mockSession, mockState, mockUser, ok } from './shared'

/** 可变状态:模拟登录态下的账户修改 */
const state = {
  email: mockAccount.email,
  password: mockAccount.password,
}

export default defineMock([
  // ── 注册:契约要求 inviteCode 固定为 taikula ──
  {
    url: '/api/register',
    method: 'POST',
    delay: 240,
    body: ({ body }) => {
      const inviteCode = String(body?.inviteCode ?? '').trim()
      if (!inviteCode) return fail(ApiCode.BODY_INVALID, '请输入邀请码')
      if (inviteCode !== mockAccount.inviteCode) {
        return fail(ApiCode.INVITE_CODE_INVALID, '邀请码无效')
      }
      return ok(mockSession)
    },
  },

  // ── 登录:固定测试账号 neo@passitai.ai / abc12345 ──
  {
    url: '/api/login',
    method: 'POST',
    delay: 240,
    body: ({ body }) => {
      if (body?.email !== state.email || body?.password !== state.password) {
        return fail(ApiCode.AUTH_INVALID_CREDENTIALS, '账号或密码错误')
      }
      return ok(mockSession)
    },
  },

  {
    url: '/api/logout',
    method: 'POST',
    delay: 100,
    body: ok(null, '已登出'),
  },

  {
    url: '/api/user',
    method: 'GET',
    delay: 100,
    body: ok({ ...mockUser, email: state.email }),
  },

  {
    url: '/api/me',
    method: 'GET',
    delay: 100,
    body: () =>
      ok({
        user: { ...mockUser, email: state.email, status: 'enabled' },
        preferences: {
          plan: mockState.plan,
          practice: { ...mockState.practice },
          notifications: { ...mockState.notifications },
        },
      }),
  },

  // ── 更新账户:修改密码 / 更换邮箱 ──
  {
    url: '/api/user/password',
    method: 'PUT',
    delay: 200,
    body: ({ body }) => {
      if (body?.currentPassword !== state.password) {
        return fail(ApiCode.AUTH_INVALID_CREDENTIALS, '当前密码不正确')
      }
      if (body?.newPassword === state.password) {
        return fail(ApiCode.REQUEST_INVALID, '新密码不能与当前密码相同')
      }
      state.password = String(body?.newPassword)
      return ok({ userId: mockUser.id, changed: true }, '密码已修改')
    },
  },

  {
    url: '/api/user/email',
    method: 'PUT',
    delay: 200,
    body: ({ body }) => {
      if (body?.password !== state.password) {
        return fail(ApiCode.AUTH_INVALID_CREDENTIALS, '当前密码不正确')
      }
      if (body?.newEmail === state.email) {
        return fail(ApiCode.REQUEST_INVALID, '新邮箱与当前邮箱相同')
      }
      state.email = String(body?.newEmail)
      return ok({ userId: mockUser.id, email: state.email }, '邮箱已更新')
    },
  },

  // ── 更新通知 ──
  {
    url: '/api/user/settings/notifications',
    method: 'GET',
    delay: 100,
    body: ok({ ...mockState.notifications }),
  },

  {
    url: '/api/user/settings/notifications',
    method: 'PATCH',
    delay: 100,
    body: ({ body }) => {
      Object.assign(mockState.notifications, body ?? {})
      return ok({ ...mockState.notifications })
    },
  },
])
