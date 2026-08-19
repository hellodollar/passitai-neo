import { request } from '@/api/http'
import type { UpdateProfileBody, UserProfile } from '@/types/domain'

export function fetchProfile() {
  return request<UserProfile>('/profile')
}

export function updateProfile(payload: UpdateProfileBody) {
  return request<UserProfile>('/profile', {
    method: 'PATCH',
    body: payload,
  })
}
