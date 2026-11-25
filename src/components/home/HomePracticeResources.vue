<script setup lang="ts">
import type { LucideIcon } from '@lucide/vue'
import { ChevronRight, History, Plus, Sparkles, Target, Timer, Trash2 } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { fetchPracticeResources } from '@/api/practice'
import { deleteAiEnhancePaper, generateAiEnhancePaper } from '@/api/subject-profile'
import BaseDialog from '@/components/common/BaseDialog.vue'
import BasePopup from '@/components/common/BasePopup.vue'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { TRAINING_MASTERY_BADGE_CLASSES } from '@/constants/practice'
import {
  aiEnhanceLabels,
  aiEnhanceTypes,
  trainingMasteryLabels,
  type AiEnhanceType,
  type PracticeResourceType,
} from '@/generated/practice-resource-values'
import { useAuthStore } from '@/stores/auth'
import type {
  Paper,
  PracticeResource,
  UserSubjectProfile,
  UserSubjectProfilePaperProgress,
} from '@/types'
import { showSuccessToast } from '@/utils/toast'

const props = withDefaults(
  defineProps<{
    subjectCode: string
    refreshKey?: number
    trainingProgress?: UserSubjectProfile['trainingProgress'] | null
  }>(),
  {
    refreshKey: 0,
    trainingProgress: null,
  },
)

const emit = defineEmits<{
  'open-paper': [paper: Paper]
  'open-paper-id': [paperId: string]
  'resources-changed': []
  loaded: []
}>()

const auth = useAuthStore()
const { records } = useLocalPracticeRecords()
const resources = ref<PracticeResource[]>([])
const selectedType = ref<PracticeResourceType>('baseline')
const loading = ref(false)
const error = ref(false)
const reloadTick = ref(0)

const generatePopupOpen = ref(false)
const selectedEnhanceType = ref<AiEnhanceType>('pointWeak')
const generating = ref(false)
const deleteTarget = ref<Paper | null>(null)
const deleting = ref(false)

let mutationSequence = 0

/** 练习资源类型固定图标与语义色映射，约定见 docs/frontend-contract.md「首页练习资源模板」。 */
const resourceStyleMap: Record<
  PracticeResourceType,
  {
    icon: LucideIcon
    tileClass: string
    activeTabClass: string
    activeIconClass: string
  }
> = {
  baseline: {
    icon: Target,
    tileClass: 'bg-primary/10 text-primary',
    activeTabClass: 'bg-primary/12 text-primary dark:bg-primary/18',
    activeIconClass: 'bg-base-100 text-primary dark:bg-base-200',
  },
  mockExams: {
    icon: Timer,
    tileClass: 'bg-accent/10 text-accent',
    activeTabClass: 'bg-accent/12 text-accent dark:bg-accent/18',
    activeIconClass: 'bg-base-100 text-accent dark:bg-base-200',
  },
  pastExams: {
    icon: History,
    tileClass: 'bg-info/10 text-info',
    activeTabClass: 'bg-info/12 text-info dark:bg-info/18',
    activeIconClass: 'bg-base-100 text-info dark:bg-base-200',
  },
  aiEnhance: {
    icon: Sparkles,
    tileClass: 'bg-ai/10 text-ai',
    activeTabClass: 'bg-ai/12 text-ai dark:bg-ai/18',
    activeIconClass: 'bg-base-100 text-ai dark:bg-base-200',
  },
}

const activeResource = computed(
  () =>
    resources.value.find((item) => item.type === selectedType.value) ?? resources.value[0] ?? null,
)

const paperProgressById = computed(() => {
  const map = new Map<string, UserSubjectProfilePaperProgress>()
  const progress = props.trainingProgress
  if (!progress) return map
  for (const slot of Object.values(progress)) {
    if (!slot?.papers) continue
    for (const paper of slot.papers) {
      map.set(paper.paperId, paper)
    }
  }
  return map
})

const answeredCountByPaperId = computed(() => {
  const map = new Map<string, number>()
  for (const record of records.value) {
    if (record.source !== 'practice') continue
    map.set(record.paperId, Object.keys(record.answers).length)
  }
  return map
})

const deleteDialogOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (open: boolean) => {
    if (!open && !deleting.value) deleteTarget.value = null
  },
})

function getAnsweredCount(paper: Paper) {
  const count = answeredCountByPaperId.value.get(paper.id) ?? 0
  return Math.min(paper.questionCount, count)
}

function getPaperProgress(paperId: string) {
  return paperProgressById.value.get(paperId) ?? null
}

async function handleGenerateAiPaper() {
  if (!props.subjectCode || !auth.session?.token || generating.value) return
  const sequence = ++mutationSequence
  const token = auth.session.token
  const code = props.subjectCode
  generating.value = true
  try {
    const paper = await generateAiEnhancePaper(code, { enhanceType: selectedEnhanceType.value })
    if (
      sequence !== mutationSequence ||
      token !== auth.session?.token ||
      code !== props.subjectCode
    ) {
      return
    }
    generatePopupOpen.value = false
    selectedType.value = 'aiEnhance'
    reloadTick.value++
    emit('resources-changed')
    showSuccessToast(`已生成「${paper.name}」`)
    emit('open-paper-id', paper.id)
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    if (sequence === mutationSequence) generating.value = false
  }
}

async function confirmDeleteAiPaper() {
  const target = deleteTarget.value
  if (!target || !props.subjectCode || !auth.session?.token || deleting.value) return
  const sequence = ++mutationSequence
  const token = auth.session.token
  const code = props.subjectCode
  deleting.value = true
  try {
    await deleteAiEnhancePaper(code, target.id)
    if (
      sequence !== mutationSequence ||
      token !== auth.session?.token ||
      code !== props.subjectCode
    ) {
      return
    }
    deleteTarget.value = null
    reloadTick.value++
    emit('resources-changed')
    showSuccessToast('已删除补强卷')
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    if (sequence === mutationSequence) deleting.value = false
  }
}

watch(
  [() => props.subjectCode, () => auth.session?.token, () => props.refreshKey, reloadTick],
  async ([code, token], _, onCleanup) => {
    error.value = false
    if (!token || !code) {
      resources.value = []
      loading.value = false
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    const isSameSubject = resources.value.some((item) =>
      item.list.some((paper) => paper.subjectCode === code),
    )
    if (!isSameSubject) {
      resources.value = []
      loading.value = true
    }
    try {
      const result = await fetchPracticeResources(code, controller.signal)
      if (controller.signal.aborted) return
      resources.value = result
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

watch([() => props.subjectCode, () => auth.session?.token], () => {
  mutationSequence++
  generating.value = false
  deleting.value = false
  generatePopupOpen.value = false
  deleteTarget.value = null
})

onBeforeUnmount(() => {
  mutationSequence++
})
</script>

<template>
  <section aria-label="练习题集" class="overflow-hidden rounded-2xl bg-base-100 dark:bg-base-200">
    <div v-if="loading && !resources.length" role="status" aria-label="正在加载…" class="p-3">
      <div class="grid grid-cols-4 gap-2">
        <div
          v-for="index in 4"
          :key="index"
          class="flex h-[4.5rem] flex-col items-center justify-center gap-1.5 rounded-xl bg-base-200/65 p-2 dark:bg-base-300/45"
        >
          <span class="size-7 animate-pulse rounded-lg bg-base-200 dark:bg-base-300/70"></span>
          <span class="h-3 w-11 animate-pulse rounded bg-base-200 dark:bg-base-300/70"></span>
        </div>
      </div>
      <div
        class="mt-3 space-y-2 border-t border-base-content/[0.06] pt-3 dark:border-base-content/[0.08]"
      >
        <div v-for="index in 3" :key="index" class="flex items-center gap-3 px-0.5 py-1.5">
          <span
            class="size-9 shrink-0 animate-pulse rounded-xl bg-base-200/80 dark:bg-base-300/60"
          ></span>
          <div class="min-w-0 flex-1 space-y-1.5">
            <span
              class="block h-3.5 w-40 animate-pulse rounded bg-base-200/80 dark:bg-base-300/60"
            ></span>
            <span
              class="block h-3 w-20 animate-pulse rounded bg-base-200/65 dark:bg-base-300/45"
            ></span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-else-if="error && !resources.length"
      role="alert"
      class="flex items-center justify-between gap-3 px-4 py-4"
    >
      <p class="text-sm font-medium text-error">加载失败</p>
      <button
        class="rounded-lg bg-error/10 px-3 py-1.5 text-xs font-medium text-error transition-colors active:bg-error/15"
        type="button"
        @click="reloadTick++"
      >
        重试
      </button>
    </div>

    <div v-else-if="!resources.length" class="px-4 py-10 text-center text-xs text-base-content/55">
      暂无练习内容
    </div>

    <template v-else>
      <div class="p-3">
        <div class="grid grid-cols-4 gap-2" role="tablist" aria-label="练习类型">
          <button
            v-for="resource in resources"
            :key="resource.id"
            class="flex min-w-0 flex-col items-center rounded-xl px-1.5 py-2 text-center transition-colors"
            :class="
              activeResource?.id === resource.id
                ? resourceStyleMap[resource.type].activeTabClass
                : 'bg-base-200/65 text-base-content/70 active:bg-base-200 dark:bg-base-300/45 dark:active:bg-base-300/70'
            "
            type="button"
            role="tab"
            :aria-selected="activeResource?.id === resource.id"
            @click="selectedType = resource.type"
          >
            <span
              class="flex size-7 items-center justify-center rounded-lg transition-colors"
              :class="
                activeResource?.id === resource.id
                  ? resourceStyleMap[resource.type].activeIconClass
                  : resourceStyleMap[resource.type].tileClass
              "
              aria-hidden="true"
            >
              <component :is="resourceStyleMap[resource.type].icon" :size="15" />
            </span>
            <span
              class="mt-1.5 block max-w-full truncate text-xs leading-tight"
              :class="activeResource?.id === resource.id ? 'font-semibold' : 'font-medium'"
            >
              {{ resource.name }}
            </span>
            <span class="mt-0.5 block text-[11px] leading-tight opacity-70 tabular-nums">
              {{ resource.list.length ? `${resource.list.length} 套` : '暂无' }}
            </span>
          </button>
        </div>
      </div>

      <div
        class="mx-3 h-px bg-base-content/[0.06] dark:bg-base-content/[0.08]"
        aria-hidden="true"
      ></div>

      <!-- AI 补强分类操作条 -->
      <div
        v-if="activeResource?.type === 'aiEnhance'"
        class="flex items-center justify-between gap-2 border-b border-base-content/[0.06] px-3.5 py-2.5 dark:border-base-content/[0.08]"
      >
        <p class="min-w-0 truncate text-xs text-base-content/55">
          按薄弱考点与错题智能组卷，最多保留 10 份
        </p>
        <button
          type="button"
          class="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-ai/10 px-2.5 text-xs font-medium text-ai transition-colors active:bg-ai/15 dark:bg-ai/15"
          @click="generatePopupOpen = true"
        >
          <Plus :size="14" aria-hidden="true" />
          生成补强卷
        </button>
      </div>

      <ul v-if="activeResource?.list.length" class="py-1">
        <li v-for="(paper, index) in activeResource.list" :key="paper.id" class="relative">
          <span
            v-if="index > 0"
            aria-hidden="true"
            class="pointer-events-none absolute left-[3.875rem] right-3.5 top-0 h-px bg-base-content/[0.06] dark:bg-base-content/[0.08]"
          ></span>
          <div class="flex min-w-0 items-center">
            <button
              class="flex min-w-0 flex-1 items-center gap-3 px-3.5 py-3 text-left transition-colors active:bg-base-200/60 dark:active:bg-base-300/50"
              :class="
                activeResource.type === 'aiEnhance' && paper.sourceType === 'ai' ? 'pr-2' : ''
              "
              type="button"
              @click="emit('open-paper', paper)"
            >
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-xl"
                :class="resourceStyleMap[activeResource.type].tileClass"
                aria-hidden="true"
              >
                <component :is="resourceStyleMap[activeResource.type].icon" :size="16" />
              </span>

              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium leading-snug text-base-content">
                  {{ paper.name }}
                </span>

                <span class="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-snug">
                  <span
                    v-if="getPaperProgress(paper.id)"
                    class="shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none"
                    :class="TRAINING_MASTERY_BADGE_CLASSES[getPaperProgress(paper.id)!.level]"
                  >
                    {{ trainingMasteryLabels[getPaperProgress(paper.id)!.level] }}
                  </span>
                  <span class="tabular-nums text-base-content/55">
                    <span
                      :class="getAnsweredCount(paper) > 0 ? 'font-medium text-base-content' : ''"
                      >{{ getAnsweredCount(paper) }}</span
                    >/{{ paper.questionCount }} 题
                  </span>
                  <span
                    v-if="getPaperProgress(paper.id)?.completedRounds"
                    class="tabular-nums text-base-content/55"
                  >
                    · 已刷 {{ getPaperProgress(paper.id)!.completedRounds }} 遍
                  </span>
                </span>
              </span>

              <ChevronRight :size="15" class="shrink-0 text-base-content/30" aria-hidden="true" />
            </button>

            <button
              v-if="activeResource.type === 'aiEnhance' && paper.sourceType === 'ai'"
              type="button"
              class="mr-2.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-base-content/45 transition-colors hover:text-error active:bg-error/10 active:text-error"
              :aria-label="`删除补强卷 ${paper.name}`"
              @click="deleteTarget = paper"
            >
              <Trash2 :size="15" aria-hidden="true" />
            </button>
          </div>
        </li>
      </ul>

      <div v-else class="px-4 py-10 text-center text-xs text-base-content/55">
        <p>
          {{ activeResource?.type === 'aiEnhance' ? '暂无 AI 补强卷' : '当前分类暂无可练习题集' }}
        </p>
        <button
          v-if="activeResource?.type === 'aiEnhance'"
          type="button"
          class="mt-3 inline-flex h-8 items-center gap-1 rounded-lg bg-ai/10 px-3.5 text-xs font-medium text-ai transition-colors active:bg-ai/15 dark:bg-ai/15"
          @click="generatePopupOpen = true"
        >
          <Sparkles :size="14" aria-hidden="true" />
          一键生成补强卷
        </button>
      </div>
    </template>

    <!-- 生成 AI 补强卷类型选择 -->
    <BasePopup
      v-model="generatePopupOpen"
      title="生成 AI 补强卷"
      :close-on-backdrop="!generating"
      :close-on-escape="!generating"
    >
      <p class="text-xs leading-snug text-base-content/55">
        基于当前科目画像与错题自动抽题组卷，生成后可在「AI 增强」中反复练习。
      </p>
      <div class="mt-3 space-y-2" role="radiogroup" aria-label="选择补强类型">
        <button
          v-for="type in aiEnhanceTypes"
          :key="type"
          type="button"
          role="radio"
          :aria-checked="selectedEnhanceType === type"
          class="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left text-sm transition-colors"
          :class="
            selectedEnhanceType === type
              ? 'border-ai/40 bg-ai/10 font-semibold text-ai dark:bg-ai/15'
              : 'border-transparent bg-base-200/65 font-medium text-base-content active:bg-base-200 dark:bg-base-300/45'
          "
          :disabled="generating"
          @click="selectedEnhanceType = type"
        >
          <span>{{ aiEnhanceLabels[type] }}</span>
          <Sparkles
            v-if="selectedEnhanceType === type"
            :size="15"
            class="shrink-0 text-ai"
            aria-hidden="true"
          />
        </button>
      </div>

      <template #footer>
        <button
          type="button"
          class="flex h-10 flex-1 items-center justify-center rounded-xl bg-base-200/70 text-sm font-medium text-base-content/75 transition-colors active:bg-base-200 disabled:opacity-50 dark:bg-base-300/45"
          :disabled="generating"
          @click="generatePopupOpen = false"
        >
          取消
        </button>
        <button
          type="button"
          class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-content transition-colors active:opacity-90 disabled:opacity-50"
          :disabled="generating"
          @click="handleGenerateAiPaper"
        >
          <span
            v-if="generating"
            class="loading loading-spinner loading-xs"
            aria-hidden="true"
          ></span>
          {{ generating ? '生成中…' : '立即生成' }}
        </button>
      </template>
    </BasePopup>

    <!-- 删除 AI 补强卷确认 -->
    <BaseDialog
      v-model="deleteDialogOpen"
      title="删除补强卷"
      :close-on-backdrop="!deleting"
      :close-on-escape="!deleting"
    >
      <p class="text-sm leading-relaxed text-base-content/70">
        确定删除「{{ deleteTarget?.name }}」？删除后将从 AI 增强列表移除并同步刷新科目画像。
      </p>
      <template #footer>
        <button
          type="button"
          class="flex h-10 flex-1 items-center justify-center rounded-xl bg-base-200/70 text-sm font-medium text-base-content/75 transition-colors active:bg-base-200 disabled:opacity-50 dark:bg-base-300/45"
          :disabled="deleting"
          @click="deleteTarget = null"
        >
          取消
        </button>
        <button
          type="button"
          class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-error text-sm font-medium text-error-content transition-colors active:opacity-90 disabled:opacity-50"
          :disabled="deleting"
          @click="confirmDeleteAiPaper"
        >
          <span
            v-if="deleting"
            class="loading loading-spinner loading-xs"
            aria-hidden="true"
          ></span>
          {{ deleting ? '删除中…' : '确认删除' }}
        </button>
      </template>
    </BaseDialog>
  </section>
</template>
