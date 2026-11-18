<script setup lang="ts">
import { AlertCircle } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchPaper } from '@/api/papers'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { PAPER_LAYOUT_LABELS, PAPER_TYPE_LABELS } from '@/constants/paper'
import { useAuthStore } from '@/stores/auth'
import type { PaperDetail } from '@/types/paper'
import { resolvePracticeReturn, returnToPracticeList } from '@/utils/browse/navigation'

const { paperId } = defineProps<{ paperId: string }>()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const paper = ref<PaperDetail | null>(null)
const loading = ref(true)
const error = ref('')
const reload = ref(0)
const optionKeys = ['A', 'B', 'C', 'D', 'E', 'F'] as const
const sections = computed(() => {
  let start = 1
  return (paper.value?.sections ?? []).map((section) => {
    const row = { ...section, start }
    start += section.items.length
    return row
  })
})

watch(
  [() => paperId, reload, () => auth.session?.token],
  async ([id, , token], _, onCleanup) => {
    let current = true
    onCleanup(() => {
      current = false
    })
    paper.value = null
    error.value = ''
    loading.value = Boolean(token)
    if (!token) return
    try {
      const result = await fetchPaper(id)
      if (current) paper.value = result
    } catch (failure) {
      if (current) error.value = failure instanceof Error ? failure.message : '题集加载失败'
    } finally {
      if (current) loading.value = false
    }
  },
  { immediate: true },
)

function back() {
  returnToPracticeList(router, resolvePracticeReturn(route.query, 'practice'))
}
</script>

<template>
  <section class="min-h-dvh bg-base-200/35 px-4 pb-8 pt-[calc(4.5rem+env(safe-area-inset-top))]">
    <PageHeader title="题集预览" back-label="返回题集列表" @back="back" />
    <div
      v-if="loading"
      role="status"
      aria-label="正在加载题集"
      class="flex min-h-56 items-center justify-center"
    >
      <span class="loading loading-spinner loading-md text-primary"></span>
    </div>
    <EmptyState
      v-else-if="error"
      :icon="AlertCircle"
      tone="error"
      :title="error"
      action-label="重试"
      embedded
      @action="reload++"
    />
    <template v-else-if="paper">
      <div class="rounded-2xl border border-base-200 bg-base-100 px-4 py-4">
        <h2 class="break-words text-lg font-semibold">{{ paper.name }}</h2>
        <p class="mt-2 text-sm text-base-content/65">
          {{ PAPER_TYPE_LABELS[paper.type] }} · {{ PAPER_LAYOUT_LABELS[paper.paperLayout] }} ·
          {{ paper.questionCount }} 题
        </p>
      </div>
      <section
        v-for="section in sections"
        :key="section.start"
        class="mt-4 overflow-hidden rounded-2xl border border-base-200 bg-base-100"
      >
        <h3 class="border-b border-base-200 px-4 py-3 text-sm font-semibold">
          {{ section.name }}
          <span v-if="section.perScore" class="ml-2 font-normal text-base-content/65"
            >每题 {{ section.perScore }} 分</span
          >
        </h3>
        <ol :start="section.start" class="list-decimal divide-y divide-base-200 pl-9 pr-4">
          <li v-for="question in section.items" :key="question.id" class="py-3 pl-1 text-sm">
            <p class="whitespace-pre-wrap break-words leading-relaxed">{{ question.title }}</p>
            <ul v-if="question.A || question.B" class="mt-2 space-y-1.5 text-base-content/75">
              <template v-for="key in optionKeys" :key="key">
                <li v-if="question[key]" class="flex gap-2 whitespace-pre-wrap break-words">
                  <span class="shrink-0 font-medium">{{ key }}.</span>
                  <span class="min-w-0">{{ question[key] }}</span>
                </li>
              </template>
            </ul>
          </li>
        </ol>
      </section>
    </template>
  </section>
</template>
