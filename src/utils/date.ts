/** 统一北京时间（Asia/Shanghai）日期与时间格式化规则。 */
export function formatShanghaiDate(value = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value)
}

export function getShanghaiDayGroup(value: string, now = new Date()): '今天' | '昨天' | '更早' {
  const key = formatShanghaiDate(new Date(value))
  if (key === formatShanghaiDate(now)) return '今天'
  if (key === formatShanghaiDate(new Date(now.getTime() - 86_400_000))) return '昨天'
  return '更早'
}

export function formatShanghaiDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
