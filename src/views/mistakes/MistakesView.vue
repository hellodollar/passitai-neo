<script setup lang="ts">
import { BookOpen, BookX, ChevronRight, CircleAlert, FileText } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchMistakeGroups } from '@/api/mistakes'
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
  label: '错题本',
  emptyTitle: '暂无错题',
  emptyDescription: '答错的题目会收集到这里。',
  icon: BookX,
}

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const browseScroll = useBrowseScroll(
  () => auth.session?.user.id ?? '',
  () => 'mistakes',
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

async function loadMistakes() {
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
    const result = await fetchMistakeGroups({
      groupBy: requestedGroup,
      sort: requestedField,
      order: requestedOrder,
    })
    if (!isCurrent()) return
    items.value = result.items
    displayedGroupMode.value = requestedGroup
    displayedSortField.value = requestedField
    displayedSortOrder.value = requestedOrder
    writeBrowseState(userId, 'mistakes', {
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
  void loadMistakes()
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
  void loadMistakes()
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
    name: 'mistakes-practice',
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
    const filters = parseCollectionFilters(route.query, readBrowseState(userId, 'mistakes'))
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
    void loadMistakes()
  },
  { immediate: true },
)
</script>

<template>
  <PageContainer>
    <section class="flex flex-col" :aria-busy="loading">
      <h1 class="sr-only">{{ pageConfig.label }}</h1>

      <!-- 分组切换 + 排序 -->
      <div
        v-if="loaded && items.length > 0"
        class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1"
      >
        <div
          class="inline-flex justify-self-start rounded-xl bg-base-200/85 p-1 dark:bg-base-200/70"
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
                ? 'bg-base-100 font-semibold text-primary'
                : 'font-medium text-base-content/65 hover:text-base-content'
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

      <PagePlaceholder v-if="loading && items.length === 0" role="status">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <p class="text-sm font-medium text-base-content/65">正在加载…</p>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="loadError && items.length === 0">
        <EmptyState
          :icon="CircleAlert"
          tone="error"
          title="加载失败"
          description="请检查网络后重试。"
          action-label="重新加载"
          @action="loadMistakes"
        />
      </PagePlaceholder>

      <PagePlaceholder v-else-if="items.length === 0">
        <EmptyState
          :icon="pageConfig.icon"
          :title="pageConfig.emptyTitle"
          :description="pageConfig.emptyDescription"
          action-label="去练习"
          @action="router.push({ name: 'home' })"
        />
      </PagePlaceholder>

      <div v-else class="mt-2 space-y-1.5 rounded-2xl bg-base-200/85 p-2.5 dark:bg-base-200/65">
        <div
          v-if="loadError"
          class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-error/10 px-3 py-2 text-xs text-error"
          role="status"
        >
          <span>更新失败，已保留原列表。</span>
          <button
            class="min-h-7 rounded-lg bg-base-100 px-2.5 font-medium text-error"
            type="button"
            @click="loadMistakes"
          >
            重试
          </button>
        </div>
        <button
          v-for="item in items"
          :key="displayedGroupMode === 'paper' ? item.paperId : item.subjectId"
          class="flex w-full min-w-0 items-center gap-2.5 rounded-xl bg-base-100 px-3 py-2.5 text-left transition-colors active:bg-base-100/80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          type="button"
          :aria-label="`${displayedGroupMode === 'paper' ? item.paperName : item.subjectName}，${item.questionCount}题，开始练习`"
          @click="openPractice(item)"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error"
          >
            <component :is="displayedGroupMode === 'paper' ? FileText : BookOpen" :size="17" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-semibold leading-snug">
              {{ displayedGroupMode === 'paper' ? item.paperName : item.subjectName }}
            </span>
            <span class="mt-0.5 block truncate text-xs leading-snug text-base-content/55">
              <template v-if="displayedGroupMode === 'paper'">{{ item.subjectName }} · </template>
              {{ formatCollectedTimeText(item.lastCollectedAt) || '已收录' }}
            </span>
          </span>

          <span
            class="shrink-0 rounded-md bg-error/[0.08] px-2 py-0.5 text-xs font-semibold tabular-nums text-error"
          >
            {{ item.questionCount }} 题
          </span>

          <ChevronRight :size="15" class="shrink-0 text-base-content/35" />
        </button>
      </div>
    </section>
  </PageContainer>
</template>
