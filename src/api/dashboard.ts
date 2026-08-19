import { request } from '@/api/http'
import type { DashboardSummary } from '@/types/domain'

export function fetchDashboard() {
  return request<DashboardSummary>('/dashboard')
}
