import { ref } from 'vue'

import { SessionChangedError } from '@/api/http'
import { createSessionGuard } from '@/utils/session-guard'

/**
 * 远程设置 Store 共享逻辑：load 按需缓存并并发去重，save 串行提交局部更新，reset 清理当前会话。
 */
export function useRemoteSettings<T extends object>(
  fetchSettings: () => Promise<T>,
  patchSettings: (body: Partial<T>) => Promise<T>,
  loadErrorMessage = '设置加载失败',
) {
  const settings = ref<T | null>(null)
  const isLoaded = ref(false)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const guard = createSessionGuard()
  let pending: { promise: Promise<T | null> } | null = null
  let patchChain: Promise<unknown> = Promise.resolve()

  function load(): Promise<T | null> {
    if (isLoaded.value) return Promise.resolve(settings.value)
    if (pending) return pending.promise

    const isCurrent = guard.captureRead()
    isLoading.value = true
    error.value = null
    const promise = fetchSettings()
      .then((value) => {
        if (!isCurrent()) return null
        settings.value = value
        isLoaded.value = true
        return value
      })
      .catch(() => {
        if (isCurrent()) error.value = loadErrorMessage
        return null
      })
      .finally(() => {
        if (pending?.promise === promise) {
          pending = null
          isLoading.value = false
        }
      })

    pending = { promise }
    return promise
  }

  function save(payload: Partial<T>): Promise<T> {
    const isCurrent = guard.captureWrite()
    guard.noteWrite()
    pending = null
    isLoading.value = false
    const request = patchChain.then(async () => {
      if (!isCurrent()) throw new SessionChangedError()
      const next = await patchSettings(payload)
      if (isCurrent()) {
        guard.noteWrite()
        pending = null
        settings.value = next
        isLoaded.value = true
        error.value = null
      }
      return next
    })
    patchChain = request.catch(() => {})
    return request
  }

  function reset() {
    guard.reset()
    patchChain = Promise.resolve()
    pending = null
    settings.value = null
    isLoaded.value = false
    isLoading.value = false
    error.value = null
  }

  return {
    reset,
    load,
    save,
    settings,
    isLoaded,
    isLoading,
    error,
  }
}
