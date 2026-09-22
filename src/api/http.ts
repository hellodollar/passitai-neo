import { FetchError, ofetch, type FetchOptions } from 'ofetch'

import { STORAGE_KEYS } from '@/constants/app'
import type { ApiEnvelope, AuthSession, PaginationResult } from '@/types/domain'
import { readStorage, removeStorage } from '@/utils/storage'
import { showErrorToast } from '@/utils/toast'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

const FALLBACK_MESSAGE = '请求失败，请稍后重试'
const NETWORK_MESSAGE = '网络连接失败，请检查网络后重试'

export type RequestOptions = FetchOptions<'json'> & {
  /** 请求失败时是否弹出全局错误提示，默认关闭，避免后台同步等静默请求被打扰 */
  notify?: boolean
}

function describeApiError(error: unknown): string {
  if (error instanceof FetchError) {
    return error.response ? FALLBACK_MESSAGE : NETWORK_MESSAGE
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return FALLBACK_MESSAGE
}

const http = ofetch.create({
  baseURL: apiBase,
  onRequest({ options }) {
    const session = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
    const headers = new Headers(options.headers)

    if (session?.token) {
      headers.set('Authorization', `Bearer ${session.token}`)
    }

    options.headers = headers
  },
  onResponse({ response }) {
    if (response.status === 401) {
      removeStorage(STORAGE_KEYS.authSession)
    }
  },
  onResponseError({ response }) {
    const message = response._data?.message || FALLBACK_MESSAGE
    throw new Error(message)
  },
})

export async function request<T>(url: string, options?: RequestOptions): Promise<T> {
  const { notify = false, ...fetchOptions } = options ?? {}

  try {
    const result = await http<ApiEnvelope<T>>(url, fetchOptions)

    if (result.code !== 0) {
      throw new Error(result.message || FALLBACK_MESSAGE)
    }

    return result.data as T
  } catch (error) {
    // 全局唯一入口：需要展示给用户的接口在这里统一弹出错误提示
    if (notify) {
      showErrorToast(describeApiError(error))
    }
    throw error
  }
}

export function normalizePagination<T>(
  value: PaginationResult<T> | T[] | null | undefined,
): PaginationResult<T> {
  if (Array.isArray(value)) {
    return { items: value, total: value.length }
  }

  if (!value || typeof value !== 'object') {
    return { items: [], total: 0 }
  }

  const items = Array.isArray(value.items) ? value.items : []
  const total = typeof value.total === 'number' ? value.total : items.length
  return { items, total }
}
