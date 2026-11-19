<script setup lang="ts">
import { BookMarked, BookOpen, ChevronRight, CircleAlert, FileText } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchFavoriteGroups } from '@/api/favorites'
import EmptyState from '@/components/common/EmptyState.vue'
import PageContainer from '@/components/common/PageContainer.vue'
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'
import SortMenu from '@/components/common/SortMenu.vue'
import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { COLLECTION_SORT_OPTIONS } from '@/constants/collection'
import { useAuthStore } from '@/stores/auth'
import type {
  CollectionAggregateItem,
  CollectionGroupBy,
  CollectionOrder,
  CollectionSort,
} from '@/types'
import {
  formatCollectedTimeText,
  parseCollectionFilters,
  readBrowseState,
  writeBrowseState,
} from '@/utils/browse/state'

const pageConfig = {
  label: '收藏夹',
  emptyTitle: '暂无收藏',
  emptyDescription: '练习时收藏的题目会出现在这里。',
  icon: BookMarked,
}

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const browseScroll = useBrowseScroll(
  () => auth.session?.user.id ?? '',
  () => 'favorites',
)
let loadedToken: string | undefined

const items = ref<CollectionAggregateItem[]>([])
const loading = ref(true)
const loaded = ref(false)
const loadError = ref(false)
let loadSequence = 0

const groupMode = ref<CollectionGroupBy>('subject')
const sortField = ref<CollectionSort>('recent')
const sortOrder = ref<CollectionOrder>('desc')
// 刷新期间保留上次成功结果及其分组，避免旧列表按新分组解释。
const displayedGroupMode = ref<CollectionGroupBy>('subject')
const displayedSortField = ref<CollectionSort>('recent')
const displayedSortOrder = ref<CollectionOrder>('desc')

async function loadFavorites() {
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
    const result = await fetchFavoriteGroups({
      groupBy: requestedGroup,
      sort: requestedField,
      order: requestedOrder,
    })
    if (!isCurrent()) return
    items.value = result.items
    displayedGroupMode.value = requestedGroup
    displayedSortField.value = requestedField
    displayedSortOrder.value = requestedOrder
    writeBrowseState(userId, 'favorites', {
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
  void loadFavorites()
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
  void loadFavorites()
}

onBeforeUnmount(() => {
  ++loadSequence
})

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
    name: 'favorites-practice',
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
    const filters = parseCollectionFilters(route.query, readBrowseState(userId, 'favorites'))
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
    void loadFavorites()
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-dvh overflow-x-hidden bg-base-200/80 dark:bg-base-100">
    <PageContainer>
      <section class="flex flex-col" :aria-busy="loading">
        <h1 class="sr-only">{{ pageConfig.label }}</h1>

        <!-- 分组切换 + 排序 -->
        <div
          v-if="loaded && items.length > 0"
          class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1"
        >
          <div
            class="inline-flex justify-self-start rounded-xl bg-base-100 p-1 dark:bg-base-200"
            role="group"
            aria-label="分组方式"
          >
            <button
              v-for="mode in [
                { value: 'subject', label: '按科目' },
                { value: 'paper', label: '按题集' },
              ]"
              :key="mode.value"
              class="flex h-7 items-center rounded-lg px-3 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:opacity-60"
              :class="
                groupMode === mode.value
                  ? 'bg-primary/12 font-semibold text-primary dark:bg-primary/18'
                  : 'font-medium text-base-content/70 hover:text-base-content'
              "
              type="button"
              :aria-disabled="loading"
              :aria-pressed="groupMode === mode.value"
              @click="selectGroupMode(mode.value as CollectionGroupBy)"
            >
              {{ mode.label }}
            </button>
          </div>

          <SortMenu
            :model-value="`${sortField}-${sortOrder}`"
            :options="COLLECTION_SORT_OPTIONS"
            :loading="loading"
            @update:model-value="selectSortOption"
          />
        </div>

        <p v-if="loading && items.length > 0" class="sr-only" role="status">正在加载列表</p>

        <PagePlaceholder v-if="loading && items.length === 0" role="status" aria-live="polite">
          <span class="loading loading-spinner loading-md text-primary" aria-hidden="true"></span>
          <p class="text-xs font-medium text-base-content/55">正在加载…</p>
        </PagePlaceholder>

        <PagePlaceholder v-else-if="loadError && items.length === 0">
          <div class="w-full rounded-2xl bg-base-100 dark:bg-base-200">
            <EmptyState
              :icon="CircleAlert"
              tone="error"
              title="加载失败"
              description="请稍后重试"
              action-label="重试"
              embedded
              @action="loadFavorites"
            />
          </div>
        </PagePlaceholder>

        <PagePlaceholder v-else-if="items.length === 0">
          <div class="w-full rounded-2xl bg-base-100 dark:bg-base-200">
            <EmptyState
              :icon="pageConfig.icon"
              :title="pageConfig.emptyTitle"
              :description="pageConfig.emptyDescription"
              action-label="去练习"
              embedded
              @action="router.push({ name: 'home' })"
            />
          </div>
        </PagePlaceholder>

        <div v-else class="mt-3 space-y-2.5">
          <div
            v-if="loadError"
            class="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-error/10 px-3.5 py-2.5 text-xs text-error"
            role="status"
          >
            <span>更新失败，已保留原列表。</span>
            <button
              class="min-h-7 rounded-lg bg-base-100 px-2.5 font-medium text-error dark:bg-base-200"
              type="button"
              @click="loadFavorites"
            >
              重试
            </button>
          </div>
          <button
            v-for="item in items"
            :key="displayedGroupMode === 'paper' ? item.paperId : item.subjectId"
            class="flex w-full min-w-0 items-center gap-3 rounded-2xl bg-base-100 px-3.5 py-3 text-left transition-colors active:bg-base-200/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:bg-base-200 dark:active:bg-base-300/50"
            type="button"
            :aria-label="`${displayedGroupMode === 'paper' ? item.paperName : item.subjectName}，${item.questionCount}题，开始练习`"
            @click="openPractice(item)"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
            >
              <component :is="displayedGroupMode === 'paper' ? FileText : BookOpen" :size="16" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-medium leading-snug text-base-content">
                {{ displayedGroupMode === 'paper' ? item.paperName : item.subjectName }}
              </span>
              <span class="mt-0.5 block truncate text-xs leading-snug text-base-content/55">
                <template v-if="displayedGroupMode === 'paper'">{{ item.subjectName }} · </template>
                {{ formatCollectedTimeText(item.lastCollectedAt) || '已收录' }}
              </span>
            </span>

            <span
              class="shrink-0 rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-medium tabular-nums text-primary"
            >
              {{ item.questionCount }} 题
            </span>

            <ChevronRight :size="15" class="shrink-0 text-base-content/30" />
          </button>
        </div>
      </section>
    </PageContainer>
  </div>
</template>
