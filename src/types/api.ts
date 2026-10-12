// ---- API envelope ----

export type ApiEnvelope<T> = {
  ok: boolean
  message: string
  data: T | null
}
