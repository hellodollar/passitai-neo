import { computed, ref } from 'vue'

import type { CollectionContext, FavoriteMutationResult, PracticePaperItem } from '@/types/domain'

type FavoriteOptions = {
  questionId: () => string | undefined
  collectionMode: () => boolean
  context: (questionId: string) => CollectionContext | null
  /** 页面加载代际和账号共同隔离迟到响应。 */
  scopeKey: () => string
  add: (context: CollectionContext) => Promise<FavoriteMutationResult>
  remove: (context: CollectionContext) => Promise<unknown>
  removeById: (favId: string) => Promise<unknown>
}

/** 收藏 ID 只来自收藏接口；题目原始科目/题集上下文不随取消收藏清除。 */
export function useQuestionFavorites(options: FavoriteOptions) {
  const favoriteQuestionIds = ref<Set<string>>(new Set())
  const pendingFavoriteQuestionIds = ref<Set<string>>(new Set())
  const favoriteError = ref('')
  const favoriteIds = new Map<string, string>()
  let generation = 0

  const currentQuestionFavorited = computed(() => {
    const id = options.questionId()
    return Boolean(id && favoriteQuestionIds.value.has(id))
  })
  const currentQuestionFavoritePending = computed(() => {
    const id = options.questionId()
    return Boolean(id && pendingFavoriteQuestionIds.value.has(id))
  })

  function resetFavorites(ids: string[] = [], items: PracticePaperItem[] = []) {
    generation++
    favoriteQuestionIds.value = new Set(ids)
    pendingFavoriteQuestionIds.value = new Set()
    favoriteError.value = ''
    favoriteIds.clear()
    for (const item of items) {
      if (item.favId) {
        favoriteIds.set(item.id, item.favId)
        favoriteQuestionIds.value.add(item.id)
      }
    }
  }

  async function toggleFavorite() {
    const questionId = options.questionId()
    if (!questionId || pendingFavoriteQuestionIds.value.has(questionId)) return

    const wasFavorited = favoriteQuestionIds.value.has(questionId)
    const context = options.context(questionId)
    const favId = favoriteIds.get(questionId)
    const removeById = wasFavorited && options.collectionMode()
    if (removeById ? !favId : !context) {
      favoriteError.value = removeById
        ? '当前题目缺少收藏 ID，请重新进入后重试'
        : '当前题目缺少题集信息，无法更新收藏'
      return
    }

    const requestGeneration = generation
    const scopeKey = options.scopeKey()
    const isCurrent = () => requestGeneration === generation && scopeKey === options.scopeKey()
    favoriteError.value = ''
    const nextIds = new Set(favoriteQuestionIds.value)
    if (wasFavorited) nextIds.delete(questionId)
    else nextIds.add(questionId)
    favoriteQuestionIds.value = nextIds
    pendingFavoriteQuestionIds.value = new Set([...pendingFavoriteQuestionIds.value, questionId])

    try {
      if (wasFavorited) {
        if (removeById) await options.removeById(favId!)
        else await options.remove(context!)
        if (isCurrent()) favoriteIds.delete(questionId)
      } else {
        const result = await options.add(context!)
        if (!result?.favId?.startsWith('fav_')) throw new Error('缺少有效的收藏 ID')
        if (isCurrent()) favoriteIds.set(questionId, result.favId)
      }
    } catch {
      if (!isCurrent()) return
      const rollbackIds = new Set(favoriteQuestionIds.value)
      if (wasFavorited) rollbackIds.add(questionId)
      else rollbackIds.delete(questionId)
      favoriteQuestionIds.value = rollbackIds
      favoriteError.value = '收藏状态更新失败，请稍后重试'
    } finally {
      if (isCurrent()) {
        const pendingIds = new Set(pendingFavoriteQuestionIds.value)
        pendingIds.delete(questionId)
        pendingFavoriteQuestionIds.value = pendingIds
      }
    }
  }

  return {
    currentQuestionFavorited,
    currentQuestionFavoritePending,
    favoriteError,
    resetFavorites,
    toggleFavorite,
  }
}
