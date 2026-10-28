import { request } from '@/api/http'
import type {
  EmailChangeBody,
  EmailChangeResult,
  PasswordChangeBody,
  PasswordChangeResult,
  User,
} from '@/types'

export function fetchProfile() {
  return request<User>('/profile', { retry: 0, timeout: 10_000 })
}

export function changePassword(payload: PasswordChangeBody) {
  return request<PasswordChangeResult>('/profile/password', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}

export function changeEmail(payload: EmailChangeBody) {
  return request<EmailChangeResult>('/profile/email', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}
