import type { DomainValue } from '@/generated/domain-values'
import type { NotificationSettings } from './entity'
import type { PracticeSettings, StudyPlan } from './practice'

// ---- Auth & User ----

export type UserRole = DomainValue<'userRole'>

export type User = {
  id: string
  email: string
  role: UserRole
  createdAt: string
}

export type AuthSession = {
  token: string
  user: User
}

export type AuthCredentials = {
  email: string
  password: string
}

export type RegisterCredentials = AuthCredentials & {
  /** 邀请码，选填：不填写可直接提交（服务端判定失败）；填写时须 6-8 位 */
  inviteCode?: string
}

export type UserMe = {
  user: User & { status: DomainValue<'dataStatus'> }
  preferences: {
    /** 未设置计划时为 null，需用户手动添加 */
    plan: StudyPlan | null
    practice: PracticeSettings
    notifications: NotificationSettings
  }
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
