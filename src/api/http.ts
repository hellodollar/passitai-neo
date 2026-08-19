import { ofetch, type FetchOptions } from 'ofetch'

import { STORAGE_KEYS } from '@/constants/app'
import type { ApiEnvelope, AuthSession, PaginationResult } from '@/types/domain'
import { readStorage, removeStorage } from '@/utils/storage'

const apiBase = import.meta.env.VITE_API_BASE_URL || '/api'

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
    const message = response._data?.message || 'Request failed'
    throw new Error(message)
  },
})

export async function request<T>(url: string, options?: FetchOptions<'json'>): Promise<T> {
  const result = await http<ApiEnvelope<T>>(url, options)

  if (result.code !== 0) {
    throw new Error(result.message)
  }

  return result.data as T
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
