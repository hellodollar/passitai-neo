import { ref, watch } from 'vue'

import { SessionChangedError } from '@/api/http'
import { useAuthStore } from '@/stores/auth'
import { currentSessionToken } from '@/utils/auth/session'

// 两类服务器开关共用相同的加载、保存、失败恢复与会话隔离规则。
export function useRemoteSettings<T extends object>(
  fetchSettings: () => Promise<T>,
  patchSettings: (body: Partial<T>) => Promise<T>,
) {
  const auth = useAuthStore()
  const settings = ref<T | null>(null)
  const loading = ref(false),
    saving = ref(false),
    error = ref('')
  let epoch = 0,
    readVersion = 0,
    pending: Promise<void> | undefined
  function reset() {
    epoch++
    readVersion++
    pending = undefined
    settings.value = null
    loading.value = false
    saving.value = false
    error.value = ''
  }
  function load(force = false): Promise<void> {
    if (saving.value) return Promise.resolve()
    if (pending) return pending
    if (settings.value && !force) return Promise.resolve()
    const version = ++readVersion,
      currentEpoch = epoch,
      token = currentSessionToken()
    const isCurrent = () =>
      version === readVersion && currentEpoch === epoch && token === currentSessionToken()
    loading.value = true
    error.value = ''
    const operation = fetchSettings()
      .then((next) => {
        if (isCurrent()) settings.value = next
      })
      .catch((e) => {
        if (isCurrent() && !(e instanceof SessionChangedError)) {
          error.value = e instanceof Error ? e.message : '设置加载失败'
        }
      })
      .finally(() => {
        if (isCurrent()) loading.value = false
        if (pending === operation) pending = undefined
      })
    pending = operation
    return operation
  }
  async function save(body: Partial<T>) {
    if (saving.value) return
    const currentEpoch = epoch,
      token = currentSessionToken()
    const isCurrent = () => currentEpoch === epoch && token === currentSessionToken()
    readVersion++
    pending = undefined
    loading.value = false
    saving.value = true
    error.value = ''
    try {
      const next = await patchSettings(body)
      if (!isCurrent()) throw new SessionChangedError()
      readVersion++
      pending = undefined
      loading.value = false
      settings.value = next
    } catch (e) {
      if (isCurrent() && !(e instanceof SessionChangedError)) {
        error.value = e instanceof Error ? e.message : '设置保存失败'
      }
      throw e
    } finally {
      if (isCurrent()) saving.value = false
    }
  }
  watch(() => auth.session?.token, reset, { flush: 'sync' })
  return { settings, loading, saving, error, load, save, reset }
}
