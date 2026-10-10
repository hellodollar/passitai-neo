import { FetchError, ofetch, type FetchOptions } from 'ofetch'

import { AUTH_INVALIDATED_EVENT, STORAGE_KEYS } from '@/constants/app'
import type { ApiEnvelope, AuthSession } from '@/types'
import { readStorage, removeStorage } from '@/utils/storage'
import { showErrorToast } from '@/utils/toast'

const configuredApiBase = import.meta.env.VITE_API_BASE_URL?.trim()
const apiBase = configuredApiBase || '/api'

const FALLBACK_MESSAGE = '请求失败，请稍后重试'
const NETWORK_MESSAGE = '网络连接失败，请检查网络后重试'

// 认证动作接口：登录/注册是公开接口，登出需要鉴权但由 signOut 自行完成本地登出；
// 这些接口的 401 不应触发全局会话失效广播（避免重复清理/跳转）。
const AUTH_ROUTES = ['/login', '/register', '/logout']

export type RequestOptions = FetchOptions<'json'> & {
  /** 请求失败时是否弹出全局错误提示，默认关闭，避免后台同步等静默请求被打扰 */
  notify?: boolean
}

/** 统一请求错误：保留 HTTP 状态（网络/超时为 null）与可读文案 */
export class ApiError extends Error {
  status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

/** 取出请求实际使用的 Bearer（可能来自显式 header 或当前会话） */
function bearerToken(headers?: HeadersInit): string | null {
  const value = new Headers(headers).get('Authorization')
  return value?.startsWith('Bearer ') ? value.slice('Bearer '.length) : null
}

/** 认证端点按路径结尾精确匹配，避免把受保护路径误判为公共端点 */
function isAuthRoute(request: unknown): boolean {
  const raw = typeof request === 'string' ? request : request instanceof Request ? request.url : ''
  const path = raw.split('?')[0] ?? ''
  return AUTH_ROUTES.some((route) => path.endsWith(route))
}

/** 401 边界：仅当失败请求使用的正是当前持久化 token 时才清除，避免清掉新会话；只派发一次事件。 */
function invalidateSession(failedToken: string | null) {
  const session = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
  if (!session?.token || failedToken !== session.token) return
  removeStorage(STORAGE_KEYS.authSession)
  window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
}

function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error
  // ofetch 只在收到非 2xx 响应时触发 onResponseError；网络/超时错误在这里归一化。
  if (error instanceof FetchError) {
    if (!error.response) return new ApiError(NETWORK_MESSAGE)
    const message = (error.response._data as { message?: string } | undefined)?.message
    return new ApiError(message || FALLBACK_MESSAGE, error.response.status)
  }
  if (error instanceof Error && error.message) return new ApiError(error.message)
  return new ApiError(FALLBACK_MESSAGE)
}

const http = ofetch.create({
  baseURL: apiBase,
  onRequest({ options }) {
    const session = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
    const headers = new Headers(options.headers)

    // 显式 Authorization（例如登出时捕获的旧 token）优先，不被当前会话覆盖。
    if (session?.token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${session.token}`)
    }

    options.headers = headers
  },
  onResponseError({ request, options, response }) {
    if (response.status === 401 && !isAuthRoute(request)) {
      invalidateSession(bearerToken(options.headers))
    }

    const message = (response._data as { message?: string } | undefined)?.message
    throw new ApiError(message || FALLBACK_MESSAGE, response.status)
  },
})

export async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  const { notify = false, ...fetchOptions } = options ?? {}

  try {
    const result = await http<ApiEnvelope<T>>(url, fetchOptions)

    // HTTP 状态决定成败；code 仅被动透传。这里只校正统一 envelope 形状。
    if (!result || typeof result !== 'object' || !('data' in result)) {
      throw new ApiError(FALLBACK_MESSAGE)
    }

    return result.data as T
  } catch (error) {
    const apiError = toApiError(error)
    // 全局唯一入口：需要展示给用户的接口在这里统一弹出错误提示
    if (notify) {
      showErrorToast(apiError.message)
    }
    throw apiError
  }
}
