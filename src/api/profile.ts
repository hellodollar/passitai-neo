import { request } from '@/api/http'
import type {
  EmailChangeBody,
  EmailChangeResult,
  PasswordChangeBody,
  PasswordChangeResult,
  UpdateProfileBody,
  UserProfile,
} from '@/types/domain'

export function fetchProfile() {
  return request<UserProfile>('/profile')
}

export function updateProfile(payload: UpdateProfileBody) {
  return request<UserProfile>('/profile', {
    method: 'PATCH',
    body: payload,
  })
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
