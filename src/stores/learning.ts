import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchAnswerSheets } from '@/api/answer-sheets'
import { deleteFavorite, fetchFavorites } from '@/api/favorites'
import { fetchPapers } from '@/api/papers'
import { deleteWrongQuestion, fetchWrongQuestions } from '@/api/wrong-questions'
import type {
  AnswerSheetListItem,
  Favorite,
  PaperListItem,
  PaperListQuery,
  WrongQuestion,
} from '@/types/domain'

export const useLearningStore = defineStore('learning', () => {
  const papers = ref<PaperListItem[]>([])
  const answerSheets = ref<AnswerSheetListItem[]>([])
  const favorites = ref<Favorite[]>([])
  const wrongQuestions = ref<WrongQuestion[]>([])
  const loading = ref(false)

  const favoritesTotal = computed(() => favorites.value.reduce((sum, fav) => sum + fav.total, 0))
  const wrongQuestionsTotal = computed(() =>
    wrongQuestions.value.reduce((sum, wq) => sum + wq.total, 0),
  )

  async function loadPapers(query: PaperListQuery = {}) {
    loading.value = true
    try {
      const result = await fetchPapers(query)
      papers.value = result.items
    } catch {
      papers.value = []
    } finally {
      loading.value = false
    }
  }

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

  async function removeFavorite(id: string) {
    await deleteFavorite(id)
    favorites.value = favorites.value.filter((fav) => fav.id !== id)
  }

  async function loadAnswerSheets() {
    loading.value = true
    try {
      const result = await fetchAnswerSheets()
      answerSheets.value = result.items
    } catch {
      answerSheets.value = []
    } finally {
      loading.value = false
    }
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

  async function removeWrongQuestion(id: string) {
    await deleteWrongQuestion(id)
    wrongQuestions.value = wrongQuestions.value.filter((wq) => wq.id !== id)
  }

  return {
    answerSheets,
    favorites,
    favoritesTotal,
    loadAnswerSheets,
    loadFavorites,
    loadPapers,
    loadWrongQuestions,
    loading,
    papers,
    removeFavorite,
    removeWrongQuestion,
    wrongQuestions,
    wrongQuestionsTotal,
  }
})
