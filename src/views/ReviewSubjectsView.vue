<script setup lang="ts">
import { AlertCircle, BookMarked, ChevronRight, Trash2, XCircle } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { clearFavorites, fetchFavoriteAggregate } from '@/api/favorites'
import { clearWrongQuestions, fetchWrongQuestionAggregate } from '@/api/wrong-questions'
import BaseDialog from '@/components/common/BaseDialog.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import { ROUTE_NAMES } from '@/constants/app'
import type { CollectionAggregateItem, ReviewSource } from '@/types/domain'
import { showErrorToast, showSuccessToast } from '@/utils/toast'

const props = defineProps<{ source: ReviewSource }>()
const router = useRouter()
const items = ref<CollectionAggregateItem[]>([])
const totalQuestionCount = ref(0)
const loading = ref(true)
const loadError = ref(false)
const clearing = ref(false)
const clearConfirmOpen = ref(false)

const isFavorites = computed(() => props.source === 'favorites')
const pageTitle = computed(() => (isFavorites.value ? '收藏题目' : '错题本'))
const emptyTitle = computed(() => (isFavorites.value ? '暂无收藏' : '暂无错题'))
const emptyDescription = computed(() =>
  isFavorites.value ? '练习时收藏的题目会出现在这里。' : '答错的题目会收集到这里。',
)

async function loadSubjects() {
  loading.value = true
  loadError.value = false
  try {
    const result = isFavorites.value
      ? await fetchFavoriteAggregate()
      : await fetchWrongQuestionAggregate()
    items.value = result.items
    totalQuestionCount.value = result.totalQuestionCount
  } catch {
    items.value = []
    totalQuestionCount.value = 0
    loadError.value = true
  } finally {
    loading.value = false
  }
}

/** 进入收藏/错题练习：虚拟题集 id = fav:<subjectId>，query.source 区分集合 */
function startPractice(item: CollectionAggregateItem) {
  void router.push({
    name: ROUTE_NAMES.practicePaper,
    params: { paperId: `fav:${item.subjectId}` },
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
    void loadSubjects()
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex min-h-[calc(100vh-8rem)] flex-col space-y-5">
    <div class="mb-3 flex items-center justify-between">
      <h2 class="text-lg font-semibold">{{ pageTitle }}</h2>
      <div v-if="!loading && !loadError && totalQuestionCount > 0" class="flex items-center gap-2">
        <span class="rounded-full bg-base-200 px-3 py-1.5 text-sm font-medium text-base-content/60">
          共 {{ totalQuestionCount }} 道
        </span>
        <button
          class="btn btn-ghost btn-sm gap-1 rounded-lg text-error"
          type="button"
          aria-label="清空"
          @click="clearConfirmOpen = true"
        >
          <Trash2 :size="15" />
          清空
        </button>
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

    <div v-else class="grid content-start gap-3">
      <button
        v-for="item in items"
        :key="item.subjectId"
        class="flex w-full items-center gap-3 rounded-2xl border border-base-200 bg-base-100 p-4 text-left transition active:scale-[0.99]"
        type="button"
        :aria-label="`${item.subjectName}，${item.questionCount}题，开始练习`"
        @click="startPractice(item)"
      >
        <span
          class="flex size-11 shrink-0 items-center justify-center rounded-xl"
          :class="isFavorites ? 'bg-primary/10 text-primary' : 'bg-error/10 text-error'"
        >
          <BookMarked v-if="isFavorites" :size="21" />
          <XCircle v-else :size="21" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold">{{ item.subjectName }}</span>
          <span class="mt-1 block text-xs text-base-content/50">{{ item.questionCount }} 题</span>
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
