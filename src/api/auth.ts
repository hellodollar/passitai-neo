import { request } from '@/api/http'
import type { AuthCredentials, AuthSession, User, UserMe } from '@/types/domain'

export function login(payload: AuthCredentials) {
  return request<AuthSession>('/login', {
    method: 'POST',
    body: payload,
  })
}

export function register(payload: AuthCredentials) {
  return request<AuthSession>('/register', {
    method: 'POST',
    body: payload,
  })
}

export async function fetchMe() {
  const data = await request<User | UserMe | null>('/me')
  if (data && typeof data === 'object' && 'user' in data) return data.user
  if (data && typeof data === 'object') return data
  return request<User>('/user')
}

export function logout() {
  return request<null>('/logout', {
    method: 'POST',
  })
}
