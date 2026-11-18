import { request } from '@/api/http'
import type {
  EmailChangeBody,
  EmailChangeResult,
  PasswordChangeBody,
  PasswordChangeResult,
  User,
} from '@/types'

export function fetchCurrentUser() {
  return request<User>('/users/me', { retry: 0, timeout: 10_000 })
}

export function changePassword(payload: PasswordChangeBody) {
  return request<PasswordChangeResult>('/users/me/password', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}

export function changeEmail(payload: EmailChangeBody) {
  return request<EmailChangeResult>('/users/me/email', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}
