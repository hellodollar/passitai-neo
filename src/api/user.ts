import { request } from '@/api/http'
import type {
  EmailChangeBody,
  EmailChangeResult,
  PasswordChangeBody,
  PasswordChangeResult,
  User,
} from '@/types'

export function fetchUser() {
  return request<User>('/user')
}

export function changePassword(payload: PasswordChangeBody) {
  return request<PasswordChangeResult>('/user/password', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}

export function changeEmail(payload: EmailChangeBody) {
  return request<EmailChangeResult>('/user/email', {
    method: 'PUT',
    body: payload,
    notify: true,
  })
}
