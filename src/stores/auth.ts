import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchMe, login, logout, register } from '@/api/auth'
import { STORAGE_KEYS } from '@/constants/app'
import type { AuthCredentials, AuthSession, RegisterCredentials, User } from '@/types/domain'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null))
  const user = ref<User | null>(session.value?.user ?? null)
  const loading = ref(false)

  const isAuthenticated = computed(() => Boolean(session.value?.token))

  function persistSession(nextSession: AuthSession) {
    session.value = nextSession
    user.value = nextSession.user
    writeStorage(STORAGE_KEYS.authSession, nextSession)
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
      user.value = await fetchMe()
    } catch {
      signOut()
    }
  }

  async function signOut() {
    try {
      if (session.value?.token) {
        await logout()
      }
    } catch {
      // ignore network errors on logout
    }
    session.value = null
    user.value = null
    removeStorage(STORAGE_KEYS.authSession)
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
