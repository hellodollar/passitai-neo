import { computed, onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'

import { login, logout, register } from '@/api/auth'
import { fetchUser } from '@/api/user'
import { AUTH_INVALIDATED_EVENT, STORAGE_KEYS } from '@/constants/app'
import { usePlanStore } from '@/stores/plan'
import { usePracticeStore } from '@/stores/practice'
import type { AuthCredentials, AuthSession, RegisterCredentials } from '@/types'
import { currentSessionToken, isActiveSession } from '@/utils/auth-session'
import { clearUserPracticeRecords } from '@/utils/practice-record'
import { clearBrowseState } from '@/utils/browse-state'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'
import { showErrorToast } from '@/utils/toast'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(
    readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null),
  )
  const user = computed(() => session.value?.user ?? null)
  const loading = ref(false)
  let generation = 0
  let userRevision = 0
  let authAttempt = 0
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let stopTracking: (() => void) | undefined
  let hydration: { token: string; generation: number; promise: Promise<void> } | null = null

  const isAuthenticated = computed(() => isActiveSession(session.value))

  function resetCaches() {
    usePracticeStore().clearSettings()
    usePlanStore().clear()
  }

  function clearExpiryTimer() {
    if (expiryTimer !== undefined) clearTimeout(expiryTimer)
    expiryTimer = undefined
  }

  function scheduleExpiry() {
    clearExpiryTimer()
    const current = session.value
    if (!isActiveSession(current)) return
    const requestGeneration = generation
    expiryTimer = setTimeout(
      () => {
        if (requestGeneration !== generation || session.value?.token !== current.token) return
        checkSession()
      },
      Math.min(Date.parse(current.expiresAt) - Date.now(), 2_147_483_647),
    )
  }

  function replaceSession(next: AuthSession | null) {
    generation++
    hydration = null
    clearExpiryTimer()
    session.value = next
    resetCaches()
    scheduleExpiry()
  }

  /** 只清理指定会话，迟到的退出或安全操作不能清掉后来登录的账号。 */
  function clearLocalSession(expectedToken = session.value?.token) {
    if (expectedToken && session.value?.token !== expectedToken) return false
    const stored = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
    if (stored?.token && stored.token !== expectedToken) {
      syncSession()
      return false
    }
    const userId = session.value?.user?.id
    if (userId) {
      clearUserPracticeRecords(userId)
      clearBrowseState(userId)
    }
    if (!stored?.token || stored.token === expectedToken) removeStorage(STORAGE_KEYS.authSession)
    replaceSession(null)
    return true
  }

  function persistSession(next: AuthSession) {
    if (!isActiveSession(next)) throw new Error('登录响应无效，请重新登录')
    writeStorage(STORAGE_KEYS.authSession, next)
    replaceSession(next)
  }

  /** 同源标签页共享会话；请求身份与页面内存身份一起切换。 */
  function syncSession() {
    const stored = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
    if (!isActiveSession(stored)) {
      if (stored) removeStorage(STORAGE_KEYS.authSession)
      if (session.value) return clearLocalSession()
      return false
    }
    if (stored.token !== session.value?.token) replaceSession(stored)
    else {
      if (JSON.stringify(stored.user) !== JSON.stringify(session.value?.user)) {
        userRevision++
        hydration = null
      }
      session.value = stored
    }
    scheduleExpiry()
    return true
  }

  function checkSession() {
    const previousToken = session.value?.token
    syncSession()
    if (previousToken && !session.value) {
      window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
    }
  }

  async function authenticate(payload: AuthCredentials | RegisterCredentials, signUp = false) {
    if (loading.value) return false
    loading.value = true
    const requestGeneration = generation
    const requestToken = currentSessionToken()
    const attempt = ++authAttempt
    try {
      const next = await (signUp ? register(payload) : login(payload))
      if (
        generation !== requestGeneration ||
        attempt !== authAttempt ||
        requestToken !== currentSessionToken()
      )
        return false
      if (!isActiveSession(next)) {
        showErrorToast('登录响应无效，请重新登录')
        return false
      }
      persistSession(next)
      return true
    } catch {
      return false
    } finally {
      if (attempt === authAttempt) loading.value = false
    }
  }

  function signIn(payload: AuthCredentials): Promise<boolean> {
    return authenticate(payload)
  }

  function signUp(payload: RegisterCredentials): Promise<boolean> {
    return authenticate(payload, true)
  }

  /** 更换邮箱后同步完整用户快照与持久化会话。 */
  function updateEmail(email: string, expectedToken = session.value?.token) {
    if (!session.value || session.value.token !== expectedToken) return
    if (!syncSession() || session.value?.token !== expectedToken) return
    userRevision++
    hydration = null
    session.value = { ...session.value, user: { ...session.value.user, email } }
    writeStorage(STORAGE_KEYS.authSession, session.value)
  }

  /** 轻量核对身份；迟到响应不能覆盖其他账号或重新建立已退出的会话。 */
  function hydrate(): Promise<void> {
    checkSession()
    const current = session.value
    if (!isActiveSession(current)) return Promise.resolve()
    if (hydration?.token === current.token && hydration.generation === generation) {
      return hydration.promise
    }
    const requestGeneration = generation
    const requestUserRevision = userRevision
    const promise = fetchUser()
      .then((nextUser) => {
        if (
          generation !== requestGeneration ||
          userRevision !== requestUserRevision ||
          session.value?.token !== current.token
        )
          return
        if (nextUser.id !== current.user.id) return
        session.value = { ...current, user: nextUser }
        writeStorage(STORAGE_KEYS.authSession, session.value)
      })
      .catch(() => {
        // 网络故障保留当前会话与本地作答；401 由统一请求层处理。
      })
      .finally(() => {
        if (hydration?.promise === promise) hydration = null
      })
    hydration = { token: current.token, generation: requestGeneration, promise }
    return promise
  }

  /** 启动、重新回到前台与绝对到期时统一核对；不会续期 JWT。 */
  function startSessionTracking() {
    if (stopTracking) return
    const storageChanged = (event: StorageEvent) => {
      if (event.key !== null && event.key !== STORAGE_KEYS.authSession) return
      const previousToken = session.value?.token
      checkSession()
      if (session.value && session.value.token !== previousToken) {
        void hydrate()
      }
    }
    const foreground = () => {
      if (document.visibilityState === 'hidden') return
      checkSession()
      void hydrate()
    }
    window.addEventListener('storage', storageChanged)
    window.addEventListener('focus', foreground)
    document.addEventListener('visibilitychange', foreground)
    stopTracking = () => {
      window.removeEventListener('storage', storageChanged)
      window.removeEventListener('focus', foreground)
      document.removeEventListener('visibilitychange', foreground)
      stopTracking = undefined
    }
    checkSession()
    void hydrate()
  }

  /** 服务端撤销失败仍完成本地退出，并明确提示撤销结果未确认。 */
  async function signOut() {
    const current = session.value
    const requestGeneration = generation
    try {
      if (current?.token) await logout(current.token)
    } catch {
      showErrorToast('已退出当前设备，服务端会话撤销未确认')
    } finally {
      if (generation === requestGeneration) clearLocalSession(current?.token)
    }
  }

  onScopeDispose(() => {
    stopTracking?.()
    clearExpiryTimer()
  })

  return {
    clearLocalSession,
    hydrate,
    isAuthenticated,
    loading,
    session,
    signIn,
    signOut,
    signUp,
    startSessionTracking,
    updateEmail,
    user,
  }
})
