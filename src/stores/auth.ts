import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { login, logout, register } from '@/api/auth'
import { fetchUserMe } from '@/api/me'
import { AUTH_INVALIDATED_EVENT, STORAGE_KEYS } from '@/constants/app'
import { usePracticeSettingsStore } from '@/stores/practiceSettings'
import type { AuthCredentials, AuthSession, RegisterCredentials, User } from '@/types/domain'
import { clearUserPracticeDrafts } from '@/utils/practice-draft'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(
    readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null),
  )
  const user = ref<User | null>(session.value?.user ?? null)
  const loading = ref(false)

  const isAuthenticated = computed(() => Boolean(session.value?.token))

  function clearLocalSession() {
    const userId = session.value?.user.id
    if (userId) clearUserPracticeDrafts(userId)
    session.value = null
    user.value = null
    removeStorage(STORAGE_KEYS.authSession)
    usePracticeSettingsStore().clear()
  }

  window.addEventListener(AUTH_INVALIDATED_EVENT, clearLocalSession)

  function persistSession(nextSession: AuthSession) {
    session.value = nextSession
    user.value = nextSession.user
    writeStorage(STORAGE_KEYS.authSession, nextSession)
    // 会话变化(登录/注册)后,刷题设置缓存按新账号重新拉取
    usePracticeSettingsStore().clear()
  }

  async function signIn(payload: AuthCredentials): Promise<boolean> {
    loading.value = true

    try {
      persistSession(await login(payload))
      return true
    } catch {
      // 错误提示由请求层统一弹出，这里只返回结果
      return false
    } finally {
      loading.value = false
    }
  }

  async function signUp(payload: RegisterCredentials): Promise<boolean> {
    loading.value = true

    try {
      persistSession(await register(payload))
      return true
    } catch {
      // 错误提示由请求层统一弹出，这里只返回结果
      return false
    } finally {
      loading.value = false
    }
  }

  /**
   * 更换邮箱后同步本地会话中的用户邮箱，避免刷新后回显旧值。
   */
  function updateEmail(email: string) {
    if (!session.value || !user.value) return
    user.value = { ...user.value, email }
    session.value = { ...session.value, user: user.value }
    writeStorage(STORAGE_KEYS.authSession, session.value)
  }

  async function hydrate() {
    if (!session.value?.token) return

    try {
      user.value = (await fetchUserMe()).user
    } catch {
      // Transient network errors must not sign the user out or erase local practice drafts.
    }
  }

  async function signOut() {
    try {
      if (session.value?.token) {
        await logout()
      }
    } catch {
      // ignore network errors on logout
    } finally {
      clearLocalSession()
    }
  }

  return {
    hydrate,
    isAuthenticated,
    loading,
    session,
    signIn,
    signOut,
    signUp,
    updateEmail,
    user,
  }
})
