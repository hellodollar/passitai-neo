import { request } from '@/api/http'
import type { UserMe } from '@/types'

export function fetchUserMe() {
  return request<UserMe>('/me')
}
