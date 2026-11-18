import type { DomainValue } from '@/generated/domain-values'

export type NotificationItem = {
  id: string
  category: DomainValue<'notificationCategory'>
  title: string
  publishedAt: string
  readAt: string | null
  linkPath: string | null
  contentPreview: string
}

export type NotificationDetail = Omit<NotificationItem, 'contentPreview'> & {
  content: string
}

export type NotificationSummary = {
  unreadCount: number
  unreadByCategory: Record<NotificationItem['category'], number>
  latestUnread: Omit<NotificationItem, 'contentPreview'> | null
}

export type NotificationList = {
  items: NotificationItem[]
  total: number
}

export type NotificationSettings = {
  inAppBanner: boolean
  contentPreview: boolean
}
