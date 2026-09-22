import { request } from '@/api/http'
import type { UserMe } from '@/types/domain'

export function fetchUserMe() {
  return request<UserMe>('/me')
}
