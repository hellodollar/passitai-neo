<script setup lang="ts">
import {
  AlertCircle,
  ArrowDownUp,
  BookMarked,
  Check,
  ChevronRight,
  Ellipsis,
  FileText,
  Trash2,
  XCircle,
} from '@lucide/vue'
import { formatDistanceToNow } from 'date-fns'
import { zhCN } from 'date-fns/locale'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { clearFavorites, fetchFavoriteAggregate } from '@/api/favorites'
import { clearWrongQuestions, fetchWrongQuestionAggregate } from '@/api/wrong-questions'
import BaseDialog from '@/components/common/BaseDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { ROUTE_NAMES } from '@/constants/app'
import type { CollectionAggregateItem, CollectionGroupBy, CollectionOrder, ReviewSource } from '@/types/domain'
import { showErrorToast, showSuccessToast } from '@/utils/toast'

type SortField = 'count' | 'recent'

const props = defineProps<{ source: ReviewSource }>()
const router = useRouter()

const items = ref<CollectionAggregateItem[]>([])
const totalQuestionCount = ref(0)
const loading = ref(true)
const loaded = ref(false)
const loadError = ref(false)
const clearing = ref(false)
const clearConfirmOpen = ref(false)
const sortMenuOpen = ref(false)
const actionsMenuOpen = ref(false)
const sortMenuRef = ref<HTMLElement | null>(null)
const actionsMenuRef = ref<HTMLElement | null>(null)
let loadSequence = 0

const groupMode = ref<CollectionGroupBy>('subject')
const sortField = ref<SortField>('recent')
const sortOrder = ref<CollectionOrder>('desc')

const isFavorites = computed(() => props.source === 'favorites')
const pageTitle = computed(() => (isFavorites.value ? '我的收藏' : '我的错题'))
const emptyTitle = computed(() => (isFavorites.value ? '暂无收藏' : '暂无错题'))
const emptyDescription = computed(() =>
  isFavorites.value ? '练习时收藏的题目会出现在这里。' : '答错的题目会收集到这里。',
)

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

function collectionSummary(item: CollectionAggregateItem) {
  const collectedAt = new Date(item.lastCollectedAt)
  if (Number.isNaN(collectedAt.getTime())) return `${item.questionCount} 题`
  const distance = formatDistanceToNow(collectedAt, {
    addSuffix: true,
    locale: zhCN,
  })
  return `${item.questionCount} 题 · ${distance}收录`
}

async function loadSubjects() {
  const sequence = ++loadSequence
  loading.value = true
  loadError.value = false
  try {
    const aggregate = isFavorites.value ? fetchFavoriteAggregate : fetchWrongQuestionAggregate
    const result = await aggregate({
      groupBy: groupMode.value,
      sort: sortField.value,
      order: sortOrder.value,
    })
    if (sequence !== loadSequence) return
    items.value = result.items
    totalQuestionCount.value = result.totalQuestionCount
  } catch {
    if (sequence !== loadSequence) return
    items.value = []
    totalQuestionCount.value = 0
    loadError.value = true
  } finally {
    if (sequence === loadSequence) {
      loading.value = false
      loaded.value = true
    }
  }
}

function selectGroupMode(mode: CollectionGroupBy) {
  if (groupMode.value === mode) return
  sortMenuOpen.value = false
  groupMode.value = mode
  void loadSubjects()
}

function selectSortOption(field: SortField, order: CollectionOrder) {
  sortMenuOpen.value = false
  if (sortField.value === field && sortOrder.value === order) return
  sortField.value = field
  sortOrder.value = order
  void loadSubjects()
}

function openClearConfirmation() {
  actionsMenuOpen.value = false
  clearConfirmOpen.value = true
}

function handleOutsideClick(event: PointerEvent) {
  const target = event.target
  if (!(target instanceof Node)) return
  if (!sortMenuRef.value?.contains(target)) sortMenuOpen.value = false
  if (!actionsMenuRef.value?.contains(target)) actionsMenuOpen.value = false
}

function handleEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape') return
  sortMenuOpen.value = false
  actionsMenuOpen.value = false
}

onMounted(() => {
  document.addEventListener('pointerdown', handleOutsideClick)
  document.addEventListener('keydown', handleEscape)
})

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', handleOutsideClick)
  document.removeEventListener('keydown', handleEscape)
})

/** 进入收藏/错题练习：虚拟题集 id = fav:<subjectId|paperId>，query.source 区分集合 */
function startPractice(item: CollectionAggregateItem) {
  const originId = groupMode.value === 'paper' ? item.paperId! : item.subjectId
  void router.push({
    name: ROUTE_NAMES.practicePaper,
    params: { paperId: `fav:${originId}` },
    query: { source: props.source, subject: item.subjectName },
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
  () => props.source,
  () => {
    loaded.value = false
    items.value = []
    totalQuestionCount.value = 0
    groupMode.value = 'subject'
    sortField.value = 'recent'
    sortOrder.value = 'desc'
    sortMenuOpen.value = false
    actionsMenuOpen.value = false
    void loadSubjects()
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex min-h-[calc(100vh-8rem)] flex-col">
    <header class="flex min-h-11 items-center justify-between gap-3">
      <div class="flex min-w-0 items-baseline gap-2.5">
        <h2 class="shrink-0 text-lg font-semibold">{{ pageTitle }}</h2>
        <span v-if="loaded && !loadError" class="text-sm text-base-content/45">
          {{ totalQuestionCount }} 道题
        </span>
      </div>
      <div
        v-if="loaded && !loadError && totalQuestionCount > 0"
        ref="actionsMenuRef"
        class="relative shrink-0"
      >
        <button
          class="flex size-10 items-center justify-center rounded-xl text-base-content/60 transition-colors hover:bg-base-200 active:bg-base-200"
          type="button"
          aria-label="更多操作"
          aria-haspopup="menu"
          :aria-expanded="actionsMenuOpen"
          @click="actionsMenuOpen = !actionsMenuOpen; sortMenuOpen = false"
        >
          <Ellipsis :size="20" />
        </button>
        <div
          v-if="actionsMenuOpen"
          class="absolute right-0 top-full z-20 mt-1 min-w-40 rounded-xl border border-base-200 bg-base-100 p-1 shadow-lg shadow-base-content/5"
          role="menu"
          aria-label="更多操作"
        >
          <button
            class="flex h-10 w-full items-center gap-2 rounded-lg px-3 text-left text-sm text-error hover:bg-error/5"
            type="button"
            role="menuitem"
            @click="openClearConfirmation"
          >
            <Trash2 :size="16" />
            清空全部{{ isFavorites ? '收藏' : '错题' }}
          </button>
        </div>
      </div>
    </header>

    <!-- 分组是主要视图切换；排序收敛为单个选择入口。 -->
    <div
      v-if="loaded && !loadError && totalQuestionCount > 0"
      class="mb-3 mt-3 flex items-end justify-between gap-2 border-b border-base-200"
    >
      <div class="flex items-center gap-5" role="group" aria-label="题目分组">
        <button
          v-for="mode in [
            { value: 'subject', label: '科目' },
            { value: 'paper', label: '题集' },
          ]"
          :key="mode.value"
          class="-mb-px flex h-11 items-center border-b-2 px-1 text-sm font-medium transition-colors"
          :class="
            groupMode === mode.value
              ? 'border-primary text-primary'
              : 'border-transparent text-base-content/55 hover:text-base-content'
          "
          type="button"
          :aria-pressed="groupMode === mode.value"
          @click="selectGroupMode(mode.value as CollectionGroupBy)"
        >
          {{ mode.label }}
        </button>
      </div>

      <div ref="sortMenuRef" class="relative shrink-0">
        <button
          class="flex h-11 items-center gap-1.5 rounded-lg px-1 text-sm text-base-content/60 hover:text-base-content"
          type="button"
          aria-label="排序方式"
          aria-haspopup="menu"
          :aria-expanded="sortMenuOpen"
          @click="sortMenuOpen = !sortMenuOpen; actionsMenuOpen = false"
        >
          <ArrowDownUp :size="15" />
          {{ activeSortLabel }}
        </button>
        <div
          v-if="sortMenuOpen"
          class="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-xl border border-base-200 bg-base-100 p-1 shadow-lg shadow-base-content/5"
          role="menu"
          aria-label="排序方式"
        >
          <button
            v-for="option in SORT_OPTIONS"
            :key="`${option.field}-${option.order}`"
            class="flex h-10 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-sm hover:bg-base-200/70"
            :class="
              sortField === option.field && sortOrder === option.order
                ? 'font-medium text-primary'
                : 'text-base-content/75'
            "
            type="button"
            role="menuitemradio"
            :aria-checked="sortField === option.field && sortOrder === option.order"
            @click="selectSortOption(option.field, option.order)"
          >
            {{ option.label }}
            <Check
              v-if="sortField === option.field && sortOrder === option.order"
              :size="15"
            />
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center">
      <span class="loading loading-spinner loading-md text-primary"></span>
    </div>

    <div v-else-if="loadError" class="flex flex-1 items-center justify-center">
      <EmptyState
        :icon="AlertCircle"
        tone="error"
        title="加载失败"
        description="请检查网络后重试。"
        action-label="重新加载"
        @action="loadSubjects"
      />
    </div>

    <div v-else-if="items.length === 0" class="flex flex-1 items-center justify-center">
      <EmptyState
        :icon="isFavorites ? BookMarked : XCircle"
        :title="emptyTitle"
        :description="emptyDescription"
        action-label="去练习"
        action-to="/"
      />
    </div>

    <div v-else class="grid content-start gap-2.5">
      <button
        v-for="item in items"
        :key="groupMode === 'paper' ? item.paperId : item.subjectId"
        class="flex w-full items-center gap-3 rounded-xl border border-base-200 bg-base-100 px-3.5 py-3 text-left transition-colors hover:border-base-300 active:bg-base-200/50"
        type="button"
        :aria-label="`${groupMode === 'paper' ? item.paperName : item.subjectName}，${item.questionCount}题，开始练习`"
        @click="startPractice(item)"
      >
        <span
          class="flex size-10 shrink-0 items-center justify-center rounded-lg"
          :class="isFavorites ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'"
        >
          <FileText v-if="groupMode === 'paper'" :size="19" />
          <BookMarked v-else-if="isFavorites" :size="19" />
          <XCircle v-else :size="19" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold">{{
            groupMode === 'paper' ? item.paperName : item.subjectName
          }}</span>
          <span class="mt-0.5 block truncate text-xs text-base-content/50">
            {{ groupMode === 'paper' ? `${item.subjectName} · ` : '' }}{{ collectionSummary(item) }}
          </span>
        </span>
        <ChevronRight :size="18" class="text-base-content/40" />
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
