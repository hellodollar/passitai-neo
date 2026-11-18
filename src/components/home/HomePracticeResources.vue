<script setup lang="ts">
import type { LucideIcon } from '@lucide/vue'
import { ChevronRight, History, Sparkles, Target, Timer } from '@lucide/vue'
import { computed, ref, watch } from 'vue'

import { fetchPracticeResources } from '@/api/practice-resources'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import type { PracticeTemplateType } from '@/generated/practice-template-values'
import { useAuthStore } from '@/stores/auth'
import type { Paper, PracticeResource } from '@/types'

const props = defineProps<{ subjectCode: string }>()
const emit = defineEmits<{ 'open-paper': [paper: Paper]; loaded: [] }>()
const auth = useAuthStore()
const { records } = useLocalPracticeRecords()
const templates = ref<PracticeResource[]>([])
const selectedType = ref<PracticeTemplateType>('baseline')
const loading = ref(false)
const error = ref(false)
const retry = ref(0)

const templateStyleMap: Record<
  PracticeTemplateType,
  {
    icon: LucideIcon
    tileClass: string
    activeTabClass: string
    activeIconClass: string
    progressClass: string
  }
> = {
  baseline: {
    icon: Target,
    tileClass: 'bg-primary/10 text-primary',
    activeTabClass: 'bg-primary/[0.12] text-primary ring-1 ring-primary/30',
    activeIconClass: 'bg-base-100 text-primary',
    progressClass: 'bg-primary',
  },
  pastExams: {
    icon: History,
    tileClass: 'bg-info/14 text-info',
    activeTabClass: 'bg-info/[0.14] text-info ring-1 ring-info/30',
    activeIconClass: 'bg-base-100 text-info',
    progressClass: 'bg-info',
  },
  mockExams: {
    icon: Timer,
    tileClass: 'bg-accent/14 text-accent',
    activeTabClass: 'bg-accent/[0.14] text-accent ring-1 ring-accent/30',
    activeIconClass: 'bg-base-100 text-accent',
    progressClass: 'bg-accent',
  },
  aiEnhance: {
    icon: Sparkles,
    tileClass: 'bg-ai/12 text-ai',
    activeTabClass: 'bg-ai/[0.12] text-ai ring-1 ring-ai/30',
    activeIconClass: 'bg-base-100 text-ai',
    progressClass: 'bg-ai',
  },
}

const activeTemplate = computed(
  () =>
    templates.value.find((item) => item.type === selectedType.value) ?? templates.value[0] ?? null,
)

const answeredCountByPaperId = computed(() => {
  const map = new Map<string, number>()
  for (const record of records.value) {
    if (record.source !== 'practice') continue
    map.set(record.paperId, Object.keys(record.answers).length)
  }
  return map
})

function getAnsweredCount(paper: Paper) {
  const count = answeredCountByPaperId.value.get(paper.id) ?? 0
  return Math.min(paper.questionCount, count)
}

function getProgressPercent(paper: Paper) {
  if (paper.questionCount <= 0) return 0
  return Math.min(100, Math.round((getAnsweredCount(paper) / paper.questionCount) * 100))
}

watch(
  [() => props.subjectCode, () => auth.session?.token, retry],
  async ([code, token], _, onCleanup) => {
    templates.value = []
    error.value = false
    loading.value = Boolean(token && code)
    if (!token || !code) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    try {
      const result = await fetchPracticeResources(code, controller.signal)
      if (controller.signal.aborted) return
      templates.value = result
      if (result.length && !result.some((item) => item.type === selectedType.value)) {
        selectedType.value = result[0]!.type
      }
      emit('loaded')
    } catch {
      if (!controller.signal.aborted) error.value = true
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <section aria-label="练习题集">
    <div v-if="loading" role="status" aria-label="正在加载…" class="space-y-2">
      <div class="grid grid-cols-4 gap-1.5">
        <div
          v-for="index in 4"
          :key="index"
          class="flex h-16 flex-col items-center justify-center gap-1.5 rounded-xl bg-base-100 p-2"
        >
          <span class="size-7 animate-pulse rounded-lg bg-base-200/80"></span>
          <span class="h-3 w-11 animate-pulse rounded bg-base-200/80"></span>
        </div>
      </div>
      <div
        v-for="index in 3"
        :key="index"
        class="flex items-center gap-2.5 rounded-xl bg-base-100 px-3 py-2.5"
      >
        <span class="size-9 shrink-0 animate-pulse rounded-xl bg-base-200/80"></span>
        <div class="min-w-0 flex-1 space-y-2">
          <span class="block h-3.5 w-32 animate-pulse rounded bg-base-200/80"></span>
          <span class="block h-1.5 w-full animate-pulse rounded-full bg-base-200/70"></span>
        </div>
      </div>
    </div>

    <div
      v-else-if="error"
      role="alert"
      class="flex items-center justify-between gap-3 rounded-xl bg-base-100 px-3 py-2.5"
    >
      <p class="text-sm font-medium text-error">加载失败</p>
      <button
        class="rounded-lg bg-error/10 px-3 py-1.5 text-xs font-medium text-error transition-colors active:bg-error/20"
        type="button"
        @click="retry++"
      >
        重试
      </button>
    </div>

    <div
      v-else-if="!templates.length"
      class="rounded-xl bg-base-100 px-4 py-7 text-center text-sm text-base-content/55"
    >
      暂无练习内容
    </div>

    <template v-else>
      <div class="grid grid-cols-4 gap-1.5" role="tablist" aria-label="练习类型">
        <button
          v-for="template in templates"
          :key="template.id"
          class="flex min-w-0 flex-col items-center rounded-xl px-1.5 py-2 text-center transition-colors"
          :class="
            activeTemplate?.id === template.id
              ? templateStyleMap[template.type].activeTabClass
              : 'bg-base-100 text-base-content/70 active:bg-base-100/80'
          "
          type="button"
          role="tab"
          :aria-selected="activeTemplate?.id === template.id"
          @click="selectedType = template.type"
        >
          <span
            class="flex size-7 items-center justify-center rounded-lg transition-colors"
            :class="
              activeTemplate?.id === template.id
                ? templateStyleMap[template.type].activeIconClass
                : templateStyleMap[template.type].tileClass
            "
            aria-hidden="true"
          >
            <component :is="templateStyleMap[template.type].icon" :size="15" />
          </span>
          <span class="mt-1.5 block max-w-full truncate text-xs font-semibold leading-tight">
            {{ template.name }}
          </span>
          <span class="mt-0.5 block text-[10px] leading-tight opacity-70 tabular-nums">
            {{ template.list.length ? `${template.list.length} 套` : '暂无' }}
          </span>
        </button>
      </div>

      <ul v-if="activeTemplate?.list.length" class="mt-2 space-y-1.5">
        <li v-for="paper in activeTemplate.list" :key="paper.id">
          <button
            class="flex w-full min-w-0 items-center gap-2.5 rounded-xl bg-base-100 px-3 py-2.5 text-left transition-colors active:bg-base-100/80"
            type="button"
            @click="emit('open-paper', paper)"
          >
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-xl"
              :class="templateStyleMap[activeTemplate.type].tileClass"
              aria-hidden="true"
            >
              <component :is="templateStyleMap[activeTemplate.type].icon" :size="17" />
            </span>

            <span class="min-w-0 flex-1">
              <span class="flex min-w-0 items-center justify-between gap-2">
                <span class="truncate text-sm font-semibold leading-snug text-base-content">
                  {{ paper.name }}
                </span>
                <span class="shrink-0 text-xs font-medium tabular-nums text-base-content/60">
                  {{ getAnsweredCount(paper) }}/{{ paper.questionCount }}
                </span>
              </span>

              <span class="mt-1.5 flex items-center gap-2">
                <span
                  class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-base-200/90"
                  aria-hidden="true"
                >
                  <span
                    class="block h-full rounded-full transition-all"
                    :class="templateStyleMap[activeTemplate.type].progressClass"
                    :style="{ width: `${getProgressPercent(paper)}%` }"
                  ></span>
                </span>
                <span
                  v-if="paper.contentPeriod && paper.contentPeriod !== paper.name"
                  class="shrink-0 text-[10px] text-base-content/50"
                >
                  {{ paper.contentPeriod }}
                </span>
              </span>
            </span>

            <ChevronRight :size="16" class="shrink-0 text-base-content/30" aria-hidden="true" />
          </button>
        </li>
      </ul>

      <div
        v-else
        class="mt-2 rounded-xl bg-base-100 px-4 py-7 text-center text-xs text-base-content/50"
      >
        当前分类暂无可练习题集
      </div>
    </template>
  </section>
</template>
