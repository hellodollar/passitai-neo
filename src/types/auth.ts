import type { DomainValue } from '@/generated/domain-values'

// ---- Auth & User ----

export type UserRole = DomainValue<'userRole'>

export type User = {
  id: string
  email: string
  role: UserRole
  status: DomainValue<'dataStatus'>
  createdAt: string
}

export type AuthSession = {
  token: string
  expiresAt: string
  user: User
}

export type AuthCredentials = {
  email: string
  password: string
}

export type RegisterCredentials = AuthCredentials & {
  /** 邀请码选填；填写时为六位字母数字，注册限制由服务端判定。 */
  inviteCode?: string
}

// ---- Account changes ----

export type PasswordChangeBody = {
  currentPassword: string
  newPassword: string
}

export type PasswordChangeResult = {
  userId: string
  changed: boolean
}

export type EmailChangeBody = {
  password: string
  newEmail: string
}

export type EmailChangeResult = {
  userId: string
  email: string
}
