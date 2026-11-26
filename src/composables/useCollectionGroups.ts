import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { COLLECTION_SORT_OPTIONS } from '@/constants/collection'
import { useAuthStore } from '@/stores/auth'
import type {
  CollectionAggregate,
  CollectionAggregateItem,
  CollectionGroupBy,
  CollectionOrder,
  CollectionQuery,
  CollectionSort,
  CollectionSource,
} from '@/types'
import { parseCollectionFilters, readBrowseState, writeBrowseState } from '@/utils/browse/state'

/**
 * 收藏夹与错题本共享的列表筛选、排序、竞态保护与跳转逻辑。
 * 页面本身保持独立（FavoritesView / MistakesView），便于各自演进 UI 与专属操作。
 */
export function useCollectionGroups(options: {
  source: CollectionSource
  fetchGroups: (query: CollectionQuery) => Promise<CollectionAggregate>
}) {
  const router = useRouter()
  const route = useRoute()
  const auth = useAuthStore()
  const browseScroll = useBrowseScroll(
    () => auth.session?.user.id ?? '',
    () => options.source,
  )

  let loadedToken: string | undefined
  let loadSequence = 0

  const items = ref<CollectionAggregateItem[]>([])
  const loading = ref(true)
  const loaded = ref(false)
  const loadError = ref(false)

  const groupMode = ref<CollectionGroupBy>('subject')
  const sortField = ref<CollectionSort>('recent')
  const sortOrder = ref<CollectionOrder>('desc')
  // 刷新期间保留上次成功结果及其分组，避免旧列表按新分组解释。
  const displayedGroupMode = ref<CollectionGroupBy>('subject')
  const displayedSortField = ref<CollectionSort>('recent')
  const displayedSortOrder = ref<CollectionOrder>('desc')

  async function loadGroups() {
    const sequence = ++loadSequence
    const userId = auth.session?.user.id ?? ''
    const token = auth.session?.token
    const isCurrent = () =>
      sequence === loadSequence && token === auth.session?.token && auth.isAuthenticated
    const requestedGroup = groupMode.value
    const requestedField = sortField.value
    const requestedOrder = sortOrder.value
    loadError.value = false
    if (!userId || !auth.isAuthenticated) {
      items.value = []
      loading.value = false
      loaded.value = false
      return
    }
    loading.value = true
    try {
      const result = await options.fetchGroups({
        groupBy: requestedGroup,
        sort: requestedField,
        order: requestedOrder,
      })
      if (!isCurrent()) return
      items.value = result.items
      displayedGroupMode.value = requestedGroup
      displayedSortField.value = requestedField
      displayedSortOrder.value = requestedOrder
      writeBrowseState(userId, options.source, {
        groupBy: requestedGroup,
        sort: requestedField,
        order: requestedOrder,
      })
      if (
        route.query.groupBy !== requestedGroup ||
        route.query.sort !== requestedField ||
        route.query.order !== requestedOrder
      ) {
        void router.replace({
          query: {
            ...route.query,
            groupBy: requestedGroup,
            sort: requestedField,
            order: requestedOrder,
          },
        })
      }
    } catch {
      if (!isCurrent()) return
      // 切换失败不清空已有列表，也不让控件显示未生效的排序或分组。
      groupMode.value = displayedGroupMode.value
      sortField.value = displayedSortField.value
      sortOrder.value = displayedSortOrder.value
      if (loaded.value) {
        void router.replace({
          query: {
            ...route.query,
            groupBy: displayedGroupMode.value,
            sort: displayedSortField.value,
            order: displayedSortOrder.value,
          },
        })
      }
      loadError.value = true
    } finally {
      if (isCurrent()) {
        loading.value = false
        loaded.value = true
        // 首次请求失败时不拿空白页的位置覆盖原列表；重试成功后再恢复。
        if (!loadError.value || items.value.length > 0) void browseScroll.restore()
      }
    }
  }

  function selectGroupMode(mode: CollectionGroupBy) {
    if (loading.value || groupMode.value === mode) return
    groupMode.value = mode
    void loadGroups()
  }

  function selectSortOption(value: string) {
    const option = COLLECTION_SORT_OPTIONS.find((item) => item.value === value)
    if (
      !option ||
      loading.value ||
      (sortField.value === option.field && sortOrder.value === option.order)
    ) {
      return
    }
    sortField.value = option.field
    sortOrder.value = option.order
    void loadGroups()
  }

  /** 按当前分组进入集合练习，返回时保留筛选条件。 */
  function openPractice(item: CollectionAggregateItem) {
    if (!auth.isAuthenticated || loading.value) return
    const originId = displayedGroupMode.value === 'paper' ? item.paperId : item.subjectId
    if (!originId) return
    const returnTo = router.resolve({
      path: route.path,
      query: {
        ...route.query,
        groupBy: displayedGroupMode.value,
        sort: displayedSortField.value,
        order: displayedSortOrder.value,
      },
    }).fullPath
    void router.push({
      name: `${options.source}-practice`,
      params: { groupBy: displayedGroupMode.value, groupId: originId },
      query: { subjectName: item.subjectName, returnTo },
    })
  }

  watch(
    [
      () => auth.session?.token,
      () => route.query.groupBy,
      () => route.query.sort,
      () => route.query.order,
    ],
    () => {
      const userId = auth.session?.user.id ?? ''
      const token = auth.session?.token ?? ''
      const filters = parseCollectionFilters(route.query, readBrowseState(userId, options.source))
      if (
        token === loadedToken &&
        filters.groupBy === groupMode.value &&
        filters.sort === sortField.value &&
        filters.order === sortOrder.value
      ) {
        return
      }
      if (token !== loadedToken) {
        loaded.value = false
        items.value = []
        browseScroll.reset()
        displayedGroupMode.value = filters.groupBy
        displayedSortField.value = filters.sort
        displayedSortOrder.value = filters.order
      }
      loadedToken = token
      groupMode.value = filters.groupBy
      sortField.value = filters.sort
      sortOrder.value = filters.order
      void loadGroups()
    },
    { immediate: true },
  )

  onBeforeUnmount(() => {
    ++loadSequence
  })

  return {
    items,
    loading,
    loaded,
    loadError,
    groupMode,
    sortField,
    sortOrder,
    displayedGroupMode,
    loadGroups,
    selectGroupMode,
    selectSortOption,
    openPractice,
  }
}
