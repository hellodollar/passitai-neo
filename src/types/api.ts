// ---- API envelope ----

export type ApiEnvelope<T> = {
  ok: boolean
  message?: string // 成功可省略，失败必填
  data: T | null
}
