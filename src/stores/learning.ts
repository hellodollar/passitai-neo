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
    const favorite = favorites.value.find((item) => item.questionId === questionId)
    if (!favorite) return
    await removeFavoriteRequest({
      paperId: favorite.paperId,
      subjectId: favorite.subjectId,
      questionId: favorite.questionId,
    })
    favorites.value = favorites.value.filter((fav) => fav.questionId !== questionId)
  }

  async function loadWrongQuestions(subjectId?: string) {
    loading.value = true
    try {
      const items: WrongQuestion[] = []
      const seen = new Set<string>()
      let page = 1
      while (true) {
        const result = await fetchWrongQuestions({ subjectId, page, limit: 100 })
        let added = 0
        for (const item of result.items) {
          if (seen.has(item.id)) continue
          seen.add(item.id)
          items.push(item)
          added++
        }
        if (items.length >= result.total || result.items.length < 100 || added === 0) break
        page++
      }
      wrongQuestions.value = items
    } finally {
      loading.value = false
    }
  }

  async function removeWrongQuestion(id: string) {
    await removeWrongQuestionRequest(id)
    wrongQuestions.value = wrongQuestions.value.filter((item) => item.id !== id)
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
