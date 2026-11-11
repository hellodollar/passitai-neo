const dateKey = (value: Date) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)

export function notificationDayGroup(value: string, now = new Date()): '今天' | '昨天' | '更早' {
  const key = dateKey(new Date(value))
  return key === dateKey(now)
    ? '今天'
    : key === dateKey(new Date(now.getTime() - 86_400_000))
      ? '昨天'
      : '更早'
}
export function notificationTime(value: string) {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(value))
}
