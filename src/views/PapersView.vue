<script setup lang="ts">
import { FileText, Search } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'

import PageHeader from '@/components/common/PageHeader.vue'
import { PAPER_TYPE_LABELS } from '@/constants/app'
import { useAppStore } from '@/stores/app'
import { useLearningStore } from '@/stores/learning'
import type { PaperType } from '@/types/domain'

const app = useAppStore()
const learning = useLearningStore()

const searchQuery = ref('')
const typeFilter = ref<PaperType | 'all'>('all')

const filteredPapers = computed(() => {
  const query = [app.globalSearch, searchQuery.value].filter(Boolean).join(' ').trim().toLowerCase()
  return learning.papers.filter((paper) => {
    const matchesQuery = !query || paper.name.toLowerCase().includes(query)
    const matchesType = typeFilter.value === 'all' || paper.paperType === typeFilter.value
    return matchesQuery && matchesType
  })
})

async function loadPapers() {
  const subjectIds = app.subjectSelection.subjectIds
  if (subjectIds.length === 0) {
    await learning.loadPapers({ limit: 100 })
    return
  }
  for (const subjectId of subjectIds) {
    await learning.loadPapers({ subjectId, limit: 100 })
  }
}

watch(
  () => app.subjectSelection.subjectIds,
  () => {
    loadPapers()
  },
)

onMounted(() => {
  loadPapers()
})
</script>

<template>
  <section class="grid gap-5">
    <PageHeader eyebrow="题包" title="练习试卷" description="按科目和类型筛选练习题包。">
      <template #actions>
        <div class="rounded-2xl border border-base-200 bg-base-100 px-3 py-1.5">
          <span class="text-xs text-base-content/50">共</span>
          <strong class="ml-2 text-lg">{{ filteredPapers.length }}</strong>
        </div>
      </template>
    </PageHeader>

    <div class="rounded-2xl border border-base-200 bg-base-100 p-3">
      <div class="grid gap-3 lg:grid-cols-[1fr_14rem]">
        <label class="input input-bordered flex h-10 items-center gap-2 rounded-2xl">
          <Search :size="16" class="text-base-content/40" />
          <input
            v-model="searchQuery"
            type="search"
            class="grow text-sm"
            placeholder="搜索试卷名称"
          />
        </label>
        <select v-model="typeFilter" class="select select-bordered h-10 w-full rounded-2xl text-sm">
          <option value="all">全部类型</option>
          <option v-for="(label, value) in PAPER_TYPE_LABELS" :key="value" :value="value">
            {{ label }}
          </option>
        </select>
      </div>
    </div>

    <div class="grid gap-3">
      <article
        v-for="paper in filteredPapers"
        :key="paper.id"
        class="rounded-2xl border border-base-200 bg-base-100 p-3 transition hover:border-primary"
      >
        <div class="flex items-center justify-between gap-4">
          <div class="flex items-center gap-3">
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
            >
              <FileText :size="18" />
            </span>
            <div class="min-w-0">
              <h2 class="truncate text-sm font-semibold">{{ paper.name }}</h2>
              <div class="mt-1 flex flex-wrap gap-1.5">
                <span class="badge badge-outline badge-sm">{{
                  PAPER_TYPE_LABELS[paper.paperType]
                }}</span>
                <span class="badge badge-ghost badge-sm">{{ paper.createdBy }}</span>
              </div>
            </div>
          </div>
          <RouterLink
            class="btn btn-primary btn-sm rounded-full"
            :to="`/practice?paperId=${paper.id}`"
          >
            开始
          </RouterLink>
        </div>
      </article>

      <div v-if="learning.loading" class="skeleton h-24"></div>
      <div
        v-if="!learning.loading && filteredPapers.length === 0"
        class="rounded-2xl border border-dashed border-base-300 p-8 text-center"
      >
        <FileText :size="28" class="mx-auto text-base-content/35" />
        <p class="mt-3 text-sm font-medium">暂无试卷</p>
        <p class="mt-1 text-xs text-base-content/50">调整科目或类型后再试。</p>
      </div>
    </div>
  </section>
</template>
