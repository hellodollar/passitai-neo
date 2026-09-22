import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchFavorites, removeFavorite as removeFavoriteRequest } from '@/api/favorites'
import {
  fetchWrongQuestions,
  removeWrongQuestion as removeWrongQuestionRequest,
} from '@/api/wrong-questions'
import type { Favorite, WrongQuestion } from '@/types/domain'

export const useLearningStore = defineStore('learning', () => {
  const favorites = ref<Favorite[]>([])
  const wrongQuestions = ref<WrongQuestion[]>([])
  const loading = ref(false)

  const favoritesTotal = computed(() => favorites.value.length)
  const wrongQuestionsTotal = computed(() => wrongQuestions.value.length)

  async function loadFavorites(subjectId?: string) {
    loading.value = true
    try {
      const result = await fetchFavorites({ subjectId })
      favorites.value = result.items
    } catch {
      favorites.value = []
    } finally {
      loading.value = false
    }
  }

  async function removeFavorite(questionId: string) {
    await removeFavoriteRequest(questionId)
    favorites.value = favorites.value.filter((fav) => fav.questionId !== questionId)
  }

  async function loadWrongQuestions(subjectId?: string) {
    loading.value = true
    try {
      const result = await fetchWrongQuestions({ subjectId })
      wrongQuestions.value = result.items
    } catch {
      wrongQuestions.value = []
    } finally {
      loading.value = false
    }
  }

  async function removeWrongQuestion(questionId: string) {
    await removeWrongQuestionRequest(questionId)
    wrongQuestions.value = wrongQuestions.value.filter((item) => item.questionId !== questionId)
  }

  return {
    favorites,
    favoritesTotal,
    loadFavorites,
    loadWrongQuestions,
    loading,
    removeFavorite,
    removeWrongQuestion,
    wrongQuestions,
    wrongQuestionsTotal,
  }
})
