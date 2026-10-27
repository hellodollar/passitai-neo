import { STORAGE_KEYS } from '@/constants/app'
import type { AuthSession } from '@/types'
import { readStorage } from '@/utils/storage'

/** 请求创建时捕获身份，重试和排队不能切换到另一个账号。 */
export function currentSessionToken(): string | null {
  const stored = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
  return typeof stored?.token === 'string' ? stored.token : null
}

/** 本地有效期只改善交互；服务端仍负责验证 JWT 和账号当前状态。 */
export function isActiveSession(value: AuthSession | null): value is AuthSession {
  return Boolean(
    value &&
    typeof value.token === 'string' &&
    value.token.length > 0 &&
    typeof value.expiresAt === 'string' &&
    Date.parse(value.expiresAt) > Date.now() &&
    value.user &&
    typeof value.user.id === 'string' &&
    typeof value.user.email === 'string' &&
    typeof value.user.createdAt === 'string' &&
    (value.user.role === 'user' || value.user.role === 'admin') &&
    value.user.status === 'enabled',
  )
}
