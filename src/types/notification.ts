import type { DomainValue } from '@/generated/domain-values'

export interface NotificationItem {
  id: string
  category: DomainValue<'notificationCategory'>
  title: string
  publishedAt: string
  readAt: string | null
  linkPath: string | null
  contentPreview: string
}
export interface NotificationDetail extends Omit<NotificationItem, 'contentPreview'> {
  content: string
}
export interface NotificationSummary {
  unreadCount: number
  unreadByCategory: Record<NotificationItem['category'], number>
  latestUnread: Omit<NotificationItem, 'contentPreview'> | null
}
export interface NotificationList {
  items: NotificationItem[]
  total: number
}
