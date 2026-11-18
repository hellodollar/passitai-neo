<script setup lang="ts">
import { ChevronRight, FileText } from '@lucide/vue'

import { PAPER_LAYOUT_LABELS, PAPER_TYPE_LABELS } from '@/constants/paper'
import { catalogPaperTypes } from '@/generated/paper-catalog-values'
import type { Paper, PaperType } from '@/types/paper'

defineProps<{
  papers: Paper[]
  type: PaperType | ''
  page: number
  totalPages: number
  loading: boolean
  error: string
}>()
const emit = defineEmits<{
  'select-type': [value: PaperType | '']
  'select-page': [value: number]
  'open-paper': [paper: Paper]
  retry: []
}>()

const types = [
  { value: '' as const, label: '全部' },
  ...catalogPaperTypes.map((value) => ({ value, label: PAPER_TYPE_LABELS[value] })),
]
</script>

<template>
  <div
    class="flex flex-wrap gap-2 border-t border-base-200 px-4 py-3"
    aria-label="题集类型"
    role="group"
  >
    <button
      v-for="option in types"
      :key="option.value"
      type="button"
      class="btn btn-sm rounded-full"
      :class="type === option.value ? 'btn-primary' : 'btn-ghost'"
      :aria-pressed="type === option.value"
      @click="emit('select-type', option.value)"
    >
      {{ option.label }}
    </button>
  </div>

  <div
    v-if="loading"
    role="status"
    aria-label="正在加载题集"
    class="flex min-h-36 items-center justify-center border-t border-base-200"
  >
    <span class="loading loading-spinner loading-sm text-primary"></span>
  </div>
  <div v-else-if="error" role="alert" class="border-t border-base-200 px-5 py-8 text-center">
    <p class="text-sm text-error">{{ error }}</p>
    <button type="button" class="btn btn-ghost btn-sm mt-2" @click="emit('retry')">重试</button>
  </div>
  <p
    v-else-if="!papers.length"
    class="border-t border-base-200 px-5 py-10 text-center text-sm text-base-content/65"
  >
    暂无题集
  </p>

  <template v-else>
    <ul class="divide-y divide-base-200 border-t border-base-200">
      <li v-for="paper in papers" :key="paper.id">
        <button
          type="button"
          class="group flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition active:bg-base-200/50"
          @click="emit('open-paper', paper)"
        >
          <span
            class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <FileText :size="17" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block break-words text-sm font-medium">{{ paper.name }}</span>
            <span class="mt-1 block text-xs text-base-content/65">
              {{ PAPER_TYPE_LABELS[paper.type] }} · {{ PAPER_LAYOUT_LABELS[paper.paperLayout] }} ·
              {{ paper.questionCount }} 题
            </span>
          </span>
          <ChevronRight :size="17" class="shrink-0 text-base-content/40" aria-hidden="true" />
        </button>
      </li>
    </ul>
    <nav
      v-if="totalPages > 1"
      aria-label="题集分页"
      class="flex items-center justify-between border-t border-base-200 px-4 py-2"
    >
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        :disabled="page === 1"
        @click="emit('select-page', page - 1)"
      >
        上一页
      </button>
      <span class="text-xs text-base-content/65">{{ page }} / {{ totalPages }}</span>
      <button
        type="button"
        class="btn btn-ghost btn-sm"
        :disabled="page === totalPages"
        @click="emit('select-page', page + 1)"
      >
        下一页
      </button>
    </nav>
  </template>
</template>
