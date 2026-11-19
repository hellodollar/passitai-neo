export type NotificationItem = {
  id: string
  title: string
  publishedAt: string
  readAt: string | null
  linkPath: string | null
  contentPreview: string
}

export type NotificationSummary = {
  unreadCount: number
  latestUnread: Pick<NotificationItem, 'id' | 'title' | 'publishedAt'> | null
}

export type NotificationList = {
  items: NotificationItem[]
  total: number
}

export type NotificationSettings = {
  inAppBanner: boolean
  contentPreview: boolean
}
