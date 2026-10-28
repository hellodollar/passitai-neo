import { computed, onScopeDispose, ref } from 'vue'
import { defineStore } from 'pinia'

import { login as loginApi, logout as logoutApi, register as registerApi } from '@/api/auth'
import {
  fetchProfile,
  changeEmail as changeEmailApi,
  changePassword as changePasswordApi,
} from '@/api/profile'
import { SessionChangedError } from '@/api/http'
import { AUTH_INVALIDATED_EVENT, STORAGE_KEYS } from '@/constants/app'
import { usePracticePlanStore } from '@/stores/practice-plan'
import { usePracticeEntriesStore } from '@/stores/practice-entries'
import { usePracticeSettingsStore } from '@/stores/practice-settings'
import type {
  AuthCredentials,
  AuthSession,
  RegisterCredentials,
  EmailChangeBody,
  PasswordChangeBody,
} from '@/types'
import { currentSessionToken, isActiveSession } from '@/utils/auth/session'
import { clearUserPracticeRecords } from '@/utils/practice/record'
import { clearBrowseState } from '@/utils/browse/state'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'
import { showErrorToast } from '@/utils/toast'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(
    readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null),
  )
  const user = computed(() => session.value?.user ?? null)
  const isLoading = ref(false)
  let generation = 0
  let userRevision = 0
  let authAttempt = 0
  let expiryTimer: ReturnType<typeof setTimeout> | undefined
  let stopTracking: (() => void) | undefined
  let initialization: Promise<void> | undefined
  let userRequest: { token: string; generation: number; promise: Promise<void> } | null = null

  const isAuthenticated = computed(() => isActiveSession(session.value))

  function resetCaches() {
    usePracticeSettingsStore().reset()
    usePracticePlanStore().reset()
    usePracticeEntriesStore().reset()
  }

  function clearExpiryTimer() {
    if (expiryTimer !== undefined) clearTimeout(expiryTimer)
    expiryTimer = undefined
  }

  function scheduleExpiryCheck() {
    clearExpiryTimer()
    const current = session.value
    if (!isActiveSession(current)) return
    const requestGeneration = generation
    expiryTimer = setTimeout(
      () => {
        if (requestGeneration !== generation || session.value?.token !== current.token) return
        checkLocalSession()
      },
      Math.min(Date.parse(current.expiresAt) - Date.now(), 2_147_483_647),
    )
  }

  function replaceSession(next: AuthSession | null) {
    generation++
    userRequest = null
    clearExpiryTimer()
    session.value = next
    resetCaches()
    scheduleExpiryCheck()
  }

  /** 只清理指定会话，迟到的退出或安全操作不能清掉后来登录的账号。 */
  function clearSession(expectedToken = session.value?.token) {
    if (expectedToken && session.value?.token !== expectedToken) return false
    const stored = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
    if (stored?.token && stored.token !== expectedToken) {
      syncSessionFromStorage()
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
  function syncSessionFromStorage() {
    const stored = readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null)
    if (!isActiveSession(stored)) {
      if (stored) removeStorage(STORAGE_KEYS.authSession)
      if (session.value) return clearSession()
      return false
    }
    if (stored.token !== session.value?.token) replaceSession(stored)
    else {
      if (JSON.stringify(stored.user) !== JSON.stringify(session.value?.user)) {
        userRevision++
        userRequest = null
      }
      session.value = stored
    }
    scheduleExpiryCheck()
    return true
  }

  function checkLocalSession() {
    const previousToken = session.value?.token
    syncSessionFromStorage()
    if (previousToken && !session.value) {
      window.dispatchEvent(new Event(AUTH_INVALIDATED_EVENT))
    }
  }

  async function authenticate(payload: AuthCredentials | RegisterCredentials, signUp = false) {
    if (isLoading.value) return false
    isLoading.value = true
    const requestGeneration = generation
    const requestToken = currentSessionToken()
    const attempt = ++authAttempt
    try {
      const next = await (signUp ? registerApi(payload) : loginApi(payload))
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
      if (attempt === authAttempt) isLoading.value = false
    }
  }

  function login(payload: AuthCredentials): Promise<boolean> {
    return authenticate(payload)
  }

  function register(payload: RegisterCredentials): Promise<boolean> {
    return authenticate(payload, true)
  }

  /** 更换邮箱后同步完整用户快照与持久化会话。 */
  function updateEmail(email: string, expectedToken = session.value?.token) {
    if (!session.value || session.value.token !== expectedToken) return
    if (!syncSessionFromStorage() || session.value?.token !== expectedToken) return
    userRevision++
    userRequest = null
    session.value = { ...session.value, user: { ...session.value.user, email } }
    writeStorage(STORAGE_KEYS.authSession, session.value)
  }

  /** 显式刷新账户资料；初始化调用一次，前台/路由/跨标签事件不调用。迟到响应不能覆盖新会话。 */
  function refreshUser(): Promise<void> {
    checkLocalSession()
    const current = session.value
    if (!isActiveSession(current)) return Promise.resolve()
    if (userRequest?.token === current.token && userRequest.generation === generation) {
      return userRequest.promise
    }
    const requestGeneration = generation
    const requestUserRevision = userRevision
    const promise = fetchProfile()
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
        if (userRequest?.promise === promise) userRequest = null
      })
    userRequest = { token: current.token, generation: requestGeneration, promise }
    return promise
  }

  /** 初始化一次：恢复已有会话时查一次用户，其余事件只同步本地会话与到期状态。 */
  function initialize(): Promise<void> {
    if (initialization) return initialization
    const storageChanged = (event: StorageEvent) => {
      if (event.key === null || event.key === STORAGE_KEYS.authSession) checkLocalSession()
    }
    const foreground = () => {
      if (document.visibilityState !== 'hidden') checkLocalSession()
    }
    window.addEventListener('storage', storageChanged)
    window.addEventListener('focus', foreground)
    document.addEventListener('visibilitychange', foreground)
    stopTracking = () => {
      window.removeEventListener('storage', storageChanged)
      window.removeEventListener('focus', foreground)
      document.removeEventListener('visibilitychange', foreground)
    }
    checkLocalSession()
    initialization = refreshUser()
    return initialization
  }

  /** 更换邮箱只提交一次；成功后直接更新当前用户，不再额外读取 /user。 */
  async function changeEmail(body: EmailChangeBody): Promise<void> {
    const token = session.value?.token
    const requestGeneration = generation
    const result = await changeEmailApi(body)
    if (
      requestGeneration !== generation ||
      token !== session.value?.token ||
      token !== currentSessionToken()
    ) {
      throw new SessionChangedError()
    }
    updateEmail(result.email, token)
  }

  /** 密码修改使旧会话失效，完成本地清理后由页面跳转登录。 */
  async function changePassword(body: PasswordChangeBody): Promise<void> {
    const token = session.value?.token
    const requestGeneration = generation
    await changePasswordApi(body)
    if (
      requestGeneration !== generation ||
      token !== session.value?.token ||
      token !== currentSessionToken() ||
      !clearSession(token)
    ) {
      throw new SessionChangedError()
    }
  }

  /** 服务端撤销失败仍完成本地退出，并明确提示撤销结果未确认。 */
  async function logout() {
    const current = session.value
    const requestGeneration = generation
    try {
      if (current?.token) await logoutApi(current.token)
    } catch {
      showErrorToast('已退出当前设备，服务端会话撤销未确认')
    }
    return generation === requestGeneration && clearSession(current?.token)
  }

  onScopeDispose(() => {
    stopTracking?.()
    clearExpiryTimer()
  })

  return {
    clearSession,
    refreshUser,
    isAuthenticated,
    isLoading,
    session,
    login,
    logout,
    register,
    initialize,
    changeEmail,
    changePassword,
    user,
  }
})
