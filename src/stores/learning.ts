import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { fetchAnswerSheets } from '@/api/answer-sheets'
import { fetchFavorites, removeFavorite as removeFavoriteRequest } from '@/api/favorites'
import { fetchPapers } from '@/api/papers'
import {
  fetchWrongQuestions,
  removeWrongQuestion as removeWrongQuestionRequest,
} from '@/api/wrong-questions'
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

  const favoritesTotal = computed(() => favorites.value.length)
  const wrongQuestionsTotal = computed(() => wrongQuestions.value.length)

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

  async function removeFavorite(questionId: string) {
    await removeFavoriteRequest(questionId)
    favorites.value = favorites.value.filter((fav) => fav.questionId !== questionId)
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

  async function removeWrongQuestion(questionId: string) {
    await removeWrongQuestionRequest(questionId)
    wrongQuestions.value = wrongQuestions.value.filter((item) => item.questionId !== questionId)
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
