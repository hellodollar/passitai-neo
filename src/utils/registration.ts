import type { RegisterCredentials } from '@/types'

/** 邀请码不区分大小写，空格只在输入两端清理。 */
export function normalizeInviteCode(value: string) {
  return value.trim().toUpperCase()
}

/** 空邀请码允许提交；服务端决定本次注册是否需要有效邀请码。 */
export function inviteCodeError(value: string) {
  const normalized = normalizeInviteCode(value)
  if (!normalized) return ''
  return /^(?=.*[A-Z])(?=.*[0-9])[A-Z0-9]{6}$/.test(normalized) ? '' : '邀请码需为6位字母和数字'
}

/** 空邀请码不进入请求；密码始终保留用户原文。 */
export function registrationPayload(input: RegisterCredentials): RegisterCredentials {
  const inviteCode = normalizeInviteCode(input.inviteCode ?? '')
  return {
    email: input.email.trim(),
    password: input.password,
    ...(inviteCode ? { inviteCode } : {}),
  }
}
