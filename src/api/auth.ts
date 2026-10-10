import { request } from '@/api/http'
import type { AuthCredentials, AuthSession, RegisterCredentials } from '@/types'

export function login(payload: AuthCredentials) {
  return request<AuthSession>('/login', {
    method: 'POST',
    body: payload,
    notify: true,
  })
}

export function register(payload: RegisterCredentials) {
  return request<AuthSession>('/register', {
    method: 'POST',
    body: payload,
    notify: true,
  })
}

export function logout() {
  return request<null>('/logout', {
    method: 'POST',
  })
}
