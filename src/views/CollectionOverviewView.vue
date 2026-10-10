<script setup lang="ts">
import {
  AlertCircle,
  ArrowDownUp,
  BookMarked,
  Check,
  ChevronRight,
  FileStack,
  Trash2,
  XCircle,
} from '@lucide/vue'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { clearFavorites, fetchFavoriteAggregate } from '@/api/favorites'
import { clearWrongQuestions, fetchWrongQuestionAggregate } from '@/api/wrong-questions'
import BaseDialog from '@/components/common/BaseDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { ROUTE_NAMES } from '@/constants/app'
import { useAuthStore } from '@/stores/auth'
import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { collectionFilters, readBrowseState, writeBrowseState } from '@/utils/browse-state'
import type {
  CollectionAggregateItem,
  CollectionGroupBy,
  CollectionOrder,
  ReviewSource,
} from '@/types/domain'
import { showErrorToast, showSuccessToast } from '@/utils/toast'

type SortField = 'count' | 'recent'

const props = defineProps<{ source: ReviewSource }>()
const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const browseScroll = useBrowseScroll(
  () => auth.session?.user.id ?? '',
  () => props.source,
)
let loadedContext = ''

const items = ref<CollectionAggregateItem[]>([])
const totalQuestionCount = ref(0)
const loading = ref(true)
const loaded = ref(false)
const loadError = ref(false)
const clearing = ref(false)
const clearConfirmOpen = ref(false)
const sortMenuOpen = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)
const sortButtonRef = ref<HTMLButtonElement | null>(null)
const sortOptionsRef = ref<HTMLElement | null>(null)
const focusedSortIndex = ref(0)
let sortTriggerWasOpen = false
let loadSequence = 0

const groupMode = ref<CollectionGroupBy>('subject')
const sortField = ref<SortField>('recent')
const sortOrder = ref<CollectionOrder>('desc')
// 刷新期间保留上次成功结果及其分组，避免旧列表按新分组解释。
const displayedGroupMode = ref<CollectionGroupBy>('subject')
const displayedSortField = ref<SortField>('recent')
const displayedSortOrder = ref<CollectionOrder>('desc')

const isFavorites = computed(() => props.source === 'favorites')
const pageTitle = computed(() => (isFavorites.value ? '我的收藏' : '我的错题'))
const emptyTitle = computed(() => (isFavorites.value ? '暂无收藏' : '暂无错题'))
const emptyDescription = computed(() =>
  isFavorites.value ? '练习时收藏的题目会出现在这里。' : '答错的题目会收集到这里。',
)
const groupLabel = computed(() => (displayedGroupMode.value === 'subject' ? '科目' : '题集'))

const SORT_OPTIONS: Array<{ field: SortField; order: CollectionOrder; label: string }> = [
  { field: 'recent', order: 'desc', label: '最近收录' },
  { field: 'recent', order: 'asc', label: '最早收录' },
  { field: 'count', order: 'desc', label: '题目最多' },
  { field: 'count', order: 'asc', label: '题目最少' },
]
const activeSortLabel = computed(
  () =>
    SORT_OPTIONS.find(
      (option) => option.field === sortField.value && option.order === sortOrder.value,
    )?.label ?? '最近收录',
)

function collectedTimeText(item: CollectionAggregateItem) {
  const collectedAt = new Date(item.lastCollectedAt)
  if (Number.isNaN(collectedAt.getTime())) return ''
  const distance = formatDistanceToNow(collectedAt, { locale: zhCN })
  return `${distance.replace(/^大约\s*/, '')}前`
}

async function loadSubjects() {
  const sequence = ++loadSequence
  const userId = auth.session?.user.id ?? ''
  const source = props.source
  const requestedGroup = groupMode.value
  const requestedField = sortField.value
  const requestedOrder = sortOrder.value
  loading.value = true
  loadError.value = false
  try {
    const aggregate = isFavorites.value ? fetchFavoriteAggregate : fetchWrongQuestionAggregate
    const result = await aggregate({
      groupBy: requestedGroup,
      sort: requestedField,
      order: requestedOrder,
    })
    if (sequence !== loadSequence || userId !== auth.session?.user.id || source !== props.source)
      return
    items.value = result.items
    totalQuestionCount.value = result.totalQuestionCount
    displayedGroupMode.value = requestedGroup
    displayedSortField.value = requestedField
    displayedSortOrder.value = requestedOrder
    writeBrowseState(userId, source, {
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
    if (sequence !== loadSequence) return
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
    if (sequence === loadSequence) {
      loading.value = false
      loaded.value = true
      // 首次请求失败时不拿空白页的位置覆盖原列表；重试成功后再恢复。
      if (!loadError.value || items.value.length > 0) void browseScroll.restore()
    }
  }
}

function selectGroupMode(mode: CollectionGroupBy) {
  if (loading.value || groupMode.value === mode) return
  closeSortMenu()
  groupMode.value = mode
  void loadSubjects()
}

function selectSortOption(field: SortField, order: CollectionOrder) {
  closeSortMenu(true)
  if (loading.value || (sortField.value === field && sortOrder.value === order)) return
  sortField.value = field
  sortOrder.value = order
  void loadSubjects()
}

async function openSortMenu(position: 'selected' | 'first' | 'last' = 'selected') {
  if (loading.value) return
  const selectedIndex = SORT_OPTIONS.findIndex(
    (option) => option.field === sortField.value && option.order === sortOrder.value,
  )
  focusedSortIndex.value =
    position === 'first'
      ? 0
      : position === 'last'
        ? SORT_OPTIONS.length - 1
        : Math.max(0, selectedIndex)
  sortMenuOpen.value = true
  await nextTick()
  if (sortMenuOpen.value) focusSortOption(focusedSortIndex.value)
}

function closeSortMenu(restoreFocus = false) {
  sortMenuOpen.value = false
  if (restoreFocus) sortButtonRef.value?.focus()
}

function toggleSortMenu() {
  const wasOpen = sortTriggerWasOpen
  sortTriggerWasOpen = false
  if (loading.value) return
  if (wasOpen || sortMenuOpen.value) closeSortMenu()
  else void openSortMenu()
}

function rememberSortMenuState() {
  // 点击触发按钮会先使菜单失焦，保留按下时的状态以正确执行收起。
  sortTriggerWasOpen = sortMenuOpen.value
}

function focusSortOption(index: number) {
  const buttons = sortOptionsRef.value?.querySelectorAll<HTMLButtonElement>('button')
  if (!buttons?.length) return
  focusedSortIndex.value = (index + buttons.length) % buttons.length
  buttons[focusedSortIndex.value]?.focus()
}

function handleSortMenuKeydown(event: KeyboardEvent) {
  const destinations: Record<string, number> = {
    ArrowDown: focusedSortIndex.value + 1,
    ArrowUp: focusedSortIndex.value - 1,
    Home: 0,
    End: SORT_OPTIONS.length - 1,
  }
  const index = destinations[event.key]
  if (index === undefined) return
  event.preventDefault()
  focusSortOption(index)
}

function handleSortMenuFocusOut(event: FocusEvent) {
  if (
    !(event.relatedTarget instanceof Node) ||
    !sortOptionsRef.value?.contains(event.relatedTarget)
  ) {
    closeSortMenu()
  }
}

function handleOutsideClick(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (!sortMenuRef.value?.contains(target)) closeSortMenu()
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !sortMenuOpen.value) return
  event.preventDefault()
  closeSortMenu(true)
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  ++loadSequence
  document.removeEventListener('pointerdown', handleOutsideClick)
  document.removeEventListener('keydown', handleEscape)
})

/** 进入收藏/错题练习：虚拟题集 id = fav:<subjectId|paperId>，query.source 区分集合 */
function startPractice(item: CollectionAggregateItem) {
  if (loading.value || clearing.value) return
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
    name: ROUTE_NAMES.practicePaper,
    params: { paperId: `fav:${originId}` },
    query: { source: props.source, subject: item.subjectName, returnTo },
  })
}

async function confirmClear() {
  if (clearing.value) return
  clearing.value = true
  try {
    if (isFavorites.value) await clearFavorites()
    else await clearWrongQuestions()
    showSuccessToast(isFavorites.value ? '收藏已清空' : '错题已清空')
    clearConfirmOpen.value = false
    await loadSubjects()
  } catch {
    showErrorToast('清空失败，请稍后重试。')
  } finally {
    clearing.value = false
  }
}

watch(
  [
    () => props.source,
    () => auth.session?.user.id,
    () => route.query.groupBy,
    () => route.query.sort,
    () => route.query.order,
  ],
  () => {
    const userId = auth.session?.user.id ?? ''
    const context = `${userId}:${props.source}`
    const filters = collectionFilters(route.query, readBrowseState(userId, props.source))
    if (
      context === loadedContext &&
      filters.groupBy === groupMode.value &&
      filters.sort === sortField.value &&
      filters.order === sortOrder.value
    )
      return
    if (context !== loadedContext) {
      loaded.value = false
      items.value = []
      totalQuestionCount.value = 0
      browseScroll.reset()
      displayedGroupMode.value = filters.groupBy
      displayedSortField.value = filters.sort
      displayedSortOrder.value = filters.order
    }
    loadedContext = context
    groupMode.value = filters.groupBy
    sortField.value = filters.sort
    sortOrder.value = filters.order
    closeSortMenu()
    clearConfirmOpen.value = false
    void loadSubjects()
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex min-h-[calc(100dvh-8rem)] flex-col" :aria-busy="loading">
    <header class="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
      <div class="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
        <h2 class="shrink-0 text-lg font-semibold leading-tight">{{ pageTitle }}</h2>
        <p
          v-if="loaded && (!loadError || totalQuestionCount > 0)"
          class="text-xs leading-snug text-base-content/45"
        >
          {{ totalQuestionCount }} 道题 · {{ items.length }} 个{{ groupLabel }}
        </p>
      </div>

      <button
        v-if="loaded && totalQuestionCount > 0"
        class="flex h-10 items-center justify-self-end gap-1 rounded-lg pl-2 text-[13px] text-primary/75 transition-colors hover:text-primary active:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-40"
        type="button"
        :disabled="loading || clearing"
        :aria-label="`清空全部${isFavorites ? '收藏' : '错题'}`"
        @click="clearConfirmOpen = true"
      >
        <Trash2 :size="14" />
        清空
      </button>
    </header>

    <!-- 分组切换 + 排序 -->
    <div
      v-if="loaded && totalQuestionCount > 0"
      class="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-1"
    >
      <div
        class="inline-flex justify-self-start rounded-full bg-base-200/70 p-0.5"
        role="group"
        aria-label="分组方式"
      >
        <button
          v-for="mode in [
            { value: 'subject', label: '按科目' },
            { value: 'paper', label: '按题集' },
          ]"
          :key="mode.value"
          class="flex h-8 items-center rounded-full px-3 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:opacity-60"
          :class="
            groupMode === mode.value
              ? 'bg-base-100 text-primary'
              : 'text-base-content/55 hover:text-base-content'
          "
          type="button"
          :aria-disabled="loading"
          :aria-pressed="groupMode === mode.value"
          @click="selectGroupMode(mode.value as CollectionGroupBy)"
        >
          {{ mode.label }}
        </button>
      </div>

      <div ref="sortMenuRef" class="relative justify-self-end">
        <button
          ref="sortButtonRef"
          class="flex h-10 items-center gap-1 rounded-lg pl-2 text-[13px] text-base-content/60 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-wait"
          type="button"
          :aria-disabled="loading"
          :aria-label="`排序方式：${activeSortLabel}`"
          aria-controls="collection-sort-options"
          aria-haspopup="menu"
          :aria-expanded="sortMenuOpen"
          @click="toggleSortMenu"
          @pointerdown="rememberSortMenuState"
          @keydown.down.prevent="openSortMenu('first')"
          @keydown.up.prevent="openSortMenu('last')"
        >
          <span
            v-if="loading"
            class="loading loading-spinner size-[14px] text-primary"
            aria-hidden="true"
          ></span>
          <ArrowDownUp v-else :size="14" />
          {{ activeSortLabel }}
        </button>
        <div
          v-if="sortMenuOpen"
          id="collection-sort-options"
          ref="sortOptionsRef"
          class="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-xl border border-base-300 bg-base-100 p-1"
          role="menu"
          aria-label="排序方式"
          @keydown="handleSortMenuKeydown"
          @focusout="handleSortMenuFocusOut"
        >
          <button
            v-for="(option, index) in SORT_OPTIONS"
            :key="`${option.field}-${option.order}`"
            class="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-sm hover:bg-base-200/70 focus-visible:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
            :class="
              sortField === option.field && sortOrder === option.order
                ? 'font-medium text-primary'
                : 'text-base-content/75'
            "
            type="button"
            role="menuitemradio"
            :tabindex="focusedSortIndex === index ? 0 : -1"
            :aria-checked="sortField === option.field && sortOrder === option.order"
            @click="selectSortOption(option.field, option.order)"
            @focus="focusedSortIndex = index"
          >
            {{ option.label }}
            <Check v-if="sortField === option.field && sortOrder === option.order" :size="15" />
          </button>
        </div>
      </div>
    </div>

    <p v-if="loading" class="sr-only" role="status">正在加载列表</p>

    <div v-if="loading && items.length === 0" class="flex flex-1 items-center justify-center py-16">
      <span class="loading loading-spinner loading-md text-primary"></span>
    </div>

    <div
      v-else-if="loadError && items.length === 0"
      class="flex flex-1 items-center justify-center py-16"
    >
      <EmptyState
        :icon="AlertCircle"
        tone="error"
        title="加载失败"
        description="请检查网络后重试。"
        action-label="重新加载"
        @action="loadSubjects"
      />
    </div>

    <div v-else-if="items.length === 0" class="flex flex-1 items-center justify-center py-16">
      <EmptyState
        :icon="isFavorites ? BookMarked : XCircle"
        :title="emptyTitle"
        :description="emptyDescription"
        action-label="去练习"
        action-to="/"
      />
    </div>

    <div v-else class="mt-2 grid content-start gap-2">
      <div
        v-if="loadError"
        class="flex flex-wrap items-center justify-between gap-2 text-xs text-base-content/60"
        role="status"
      >
        <span>更新失败，已保留原列表。</span>
        <button class="min-h-11 px-2 text-primary" type="button" @click="loadSubjects">重试</button>
      </div>
      <button
        v-for="item in items"
        :key="displayedGroupMode === 'paper' ? item.paperId : item.subjectId"
        class="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-base-200 bg-base-100 px-3 py-3 text-left transition-colors hover:border-base-300 active:bg-base-200/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
        type="button"
        :aria-label="`${displayedGroupMode === 'paper' ? item.paperName : item.subjectName}，${item.questionCount}题，开始练习`"
        @click="startPractice(item)"
      >
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
        >
          <FileStack :size="18" />
        </span>

        <span class="min-w-0 flex-1">
          <span class="line-clamp-2 break-words text-[15px] font-semibold leading-snug">
            {{ displayedGroupMode === 'paper' ? item.paperName : item.subjectName }}
          </span>
          <span class="mt-1 block truncate text-xs leading-snug text-base-content/45">
            <template v-if="displayedGroupMode === 'paper'">{{ item.subjectName }} · </template>
            {{ collectedTimeText(item) ? `最近收录 · ${collectedTimeText(item)}` : '最近收录' }}
          </span>
        </span>

        <span class="shrink-0 text-sm font-medium tabular-nums text-base-content/60">
          {{ item.questionCount }} 题
        </span>

        <ChevronRight :size="18" class="shrink-0 text-base-content/35" />
      </button>
    </div>

    <BaseDialog v-model="clearConfirmOpen" title="确认清空">
      <p class="text-sm leading-6 text-base-content/70">
        将清空全部{{ isFavorites ? '收藏' : '错题' }}（{{ totalQuestionCount }} 道），操作不可恢复。
      </p>
      <template #footer>
        <button
          class="btn h-10 min-h-10 flex-1 rounded-xl border-base-200 bg-base-100 text-sm"
          type="button"
          :disabled="clearing"
          @click="clearConfirmOpen = false"
        >
          取消
        </button>
        <button
          class="btn btn-error h-10 min-h-10 flex-1 rounded-xl text-sm"
          type="button"
          :disabled="clearing"
          @click="confirmClear"
        >
          <span v-if="clearing" class="loading loading-spinner loading-xs"></span>
          清空
        </button>
      </template>
    </BaseDialog>
  </section>
</template>
