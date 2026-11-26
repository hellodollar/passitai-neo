<script setup lang="ts">
import { BookOpen, BookX, ChevronRight, CircleAlert, FileText } from '@lucide/vue'
import { useRouter } from 'vue-router'

import { fetchMistakeGroups } from '@/api/mistakes'
import EmptyState from '@/components/common/EmptyState.vue'
import PageContainer from '@/components/common/PageContainer.vue'
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'
import SortMenu from '@/components/common/SortMenu.vue'
import { useCollectionGroups } from '@/composables/useCollectionGroups'
import { COLLECTION_SORT_OPTIONS } from '@/constants/collection'
import type { CollectionGroupBy } from '@/types'
import { formatCollectedTimeText } from '@/utils/browse/state'

const pageConfig = {
  label: '错题本',
  emptyTitle: '暂无错题',
  emptyDescription: '答错的题目会收集到这里。',
  icon: BookX,
}

const router = useRouter()
const {
  items,
  loading,
  loaded,
  loadError,
  groupMode,
  sortField,
  sortOrder,
  displayedGroupMode,
  loadGroups: loadMistakes,
  selectGroupMode,
  selectSortOption,
  openPractice,
} = useCollectionGroups({
  source: 'mistakes',
  fetchGroups: fetchMistakeGroups,
})
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
              @action="loadMistakes"
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
            class="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-error/10 px-3.5 py-2.5 text-xs text-error"
            role="status"
          >
            <span>更新失败，已保留原列表。</span>
            <button
              class="min-h-7 rounded-lg bg-base-100 px-2.5 font-medium text-error dark:bg-base-200"
              type="button"
              @click="loadMistakes"
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
              class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-error/10 text-error"
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
              class="shrink-0 rounded-lg bg-error/10 px-2 py-0.5 text-xs font-medium tabular-nums text-error"
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
