import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchMe, login, logout, register } from '@/api/auth'
import { STORAGE_KEYS } from '@/constants/app'
import type { AuthCredentials, AuthSession, User } from '@/types/domain'
import { readStorage, removeStorage, writeStorage } from '@/utils/storage'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<AuthSession | null>(readStorage<AuthSession | null>(STORAGE_KEYS.authSession, null))
  const user = ref<User | null>(session.value?.user ?? null)
  const loading = ref(false)
  const error = ref('')

  const isAuthenticated = computed(() => Boolean(session.value?.token))

  function persistSession(nextSession: AuthSession) {
    session.value = nextSession
    user.value = nextSession.user
    writeStorage(STORAGE_KEYS.authSession, nextSession)
  }

  async function signIn(payload: AuthCredentials) {
    loading.value = true
    error.value = ''

    try {
      persistSession(await login(payload))
    } catch (currentError) {
      error.value = currentError instanceof Error ? currentError.message : 'Unable to sign in'
      throw currentError
    } finally {
      loading.value = false
    }
  }

  async function signUp(payload: AuthCredentials) {
    loading.value = true
    error.value = ''

    try {
      persistSession(await register(payload))
    } catch (currentError) {
      error.value = currentError instanceof Error ? currentError.message : 'Unable to create account'
      throw currentError
    } finally {
      loading.value = false
    }
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
    error,
    hydrate,
    isAuthenticated,
    loading,
    session,
    signIn,
    signOut,
    signUp,
    user,
  }
})
