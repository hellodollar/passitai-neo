import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { DEFAULT_APP_PREFERENCES, DEFAULT_SUBJECT_SELECTION, STORAGE_KEYS } from '@/constants/app'
import type { AppPreferences, SubjectSelection } from '@/types/domain'
import { readStorage, writeStorage } from '@/utils/storage'

export const useAppStore = defineStore('app', () => {
  const preferences = ref<AppPreferences>(
    readStorage<AppPreferences>(STORAGE_KEYS.appPreferences, { ...DEFAULT_APP_PREFERENCES }),
  )
  const subjectSelection = ref<SubjectSelection>(
    readStorage<SubjectSelection>(STORAGE_KEYS.subjectSelection, { ...DEFAULT_SUBJECT_SELECTION }),
  )
  const bootstrapped = ref(false)
  const mobileDrawerOpen = ref(false)
  const globalSearch = ref('')
  const practiceSessionActive = ref(false)
  const practiceSessionPaperIds = ref<string[]>([])
  const isOnline = ref(typeof navigator === 'undefined' ? true : navigator.onLine)

  const isCompactNavigation = computed(() => preferences.value.sidebarCollapsed)
  const hasSubjectSelection = computed(
    () => subjectSelection.value.subjectIds.length > 0,
  )

  function bootstrap() {
    if (bootstrapped.value) return

    document.documentElement.setAttribute('data-theme', preferences.value.theme)
    window.addEventListener('online', () => {
      isOnline.value = true
    })
    window.addEventListener('offline', () => {
      isOnline.value = false
    })
    bootstrapped.value = true
  }

  function updatePreferences(payload: Partial<AppPreferences>) {
    preferences.value = { ...preferences.value, ...payload }
    writeStorage(STORAGE_KEYS.appPreferences, preferences.value)
    document.documentElement.setAttribute('data-theme', preferences.value.theme)
  }

  function setGlobalSearch(value: string) {
    globalSearch.value = value
  }

  function setPracticeSessionActive(active: boolean) {
    practiceSessionActive.value = active
  }

  function startPracticeSession(paperIds: string[]) {
    practiceSessionPaperIds.value = paperIds
    practiceSessionActive.value = true
  }

  function endPracticeSession() {
    practiceSessionActive.value = false
    practiceSessionPaperIds.value = []
  }

  function toggleMobileDrawer(open = !mobileDrawerOpen.value) {
    mobileDrawerOpen.value = open
  }

  function setSubjectSelection(payload: SubjectSelection) {
    subjectSelection.value = payload
    writeStorage(STORAGE_KEYS.subjectSelection, payload)
  }

  return {
    bootstrap,
    bootstrapped,
    globalSearch,
    hasSubjectSelection,
    isCompactNavigation,
    isOnline,
    mobileDrawerOpen,
    preferences,
    practiceSessionActive,
    practiceSessionPaperIds,
    setGlobalSearch,
    setPracticeSessionActive,
    setSubjectSelection,
    startPracticeSession,
    endPracticeSession,
    subjectSelection,
    toggleMobileDrawer,
    updatePreferences,
  }
})
