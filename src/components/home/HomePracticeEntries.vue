<script setup lang="ts">
import {
  BookOpenCheck,
  ChevronRight,
  ClipboardCheck,
  ListChecks,
  Sparkles,
  Target,
} from '@lucide/vue'
import { computed } from 'vue'

import AiPracticePanel from '@/components/home/AiPracticePanel.vue'
import { BASELINE_CHILD_ICONS } from '@/constants/practice-icons'
import type { PracticeEntry, PracticeEntryChild } from '@/types'

const props = defineProps<{
  entries: PracticeEntry[]
  selectedEntry: string
  loading: boolean
  subjectName: string
}>()

const emit = defineEmits<{
  'select-entry': [key: string]
  'start-paper': [child: PracticeEntryChild]
}>()

type EntryTone = 'primary' | 'secondary' | 'accent' | 'ai'

const entryStyles: Record<PracticeEntry['type'], { tone: EntryTone; icon: typeof ListChecks }> = {
  baseline: { tone: 'primary', icon: ListChecks },
  pastExam: { tone: 'secondary', icon: BookOpenCheck },
  mock: { tone: 'accent', icon: ClipboardCheck },
  aiPractice: { tone: 'ai', icon: Sparkles },
}

const entryToneStyles: Record<
  EntryTone,
  { icon: string; active: string; progress: string; chevron: string }
> = {
  primary: {
    icon: 'bg-primary/10 text-primary',
    active: 'bg-primary/10 text-primary ring-primary/40',
    progress: 'bg-primary',
    chevron: 'group-active:text-primary',
  },
  secondary: {
    icon: 'bg-secondary/10 text-secondary',
    active: 'bg-secondary/10 text-secondary ring-secondary/40',
    progress: 'bg-secondary',
    chevron: 'group-active:text-secondary',
  },
  accent: {
    icon: 'bg-accent/15 text-accent',
    active: 'bg-accent/15 text-accent ring-accent/40',
    progress: 'bg-accent',
    chevron: 'group-active:text-accent',
  },
  ai: {
    icon: 'bg-ai/10 text-ai',
    active: 'bg-ai/10 text-ai ring-ai/40',
    progress: 'bg-ai',
    chevron: 'group-active:text-ai',
  },
}

const entryRows = computed(() =>
  props.entries.map((entry) => ({
    ...entry,
    ...entryStyles[entry.type],
  })),
)
const activeEntry = computed(
  () => entryRows.value.find((entry) => entry.type === props.selectedEntry) ?? entryRows.value[0],
)
const activeEntryChildren = computed(() => {
  const entry = activeEntry.value
  if (!entry) return []

  const tone = entryToneStyles[entry.tone]
  return (entry.children ?? []).map((child) => ({
    ...child,
    icon:
      entry.type === 'baseline'
        ? ((child.assessmentType ? BASELINE_CHILD_ICONS[child.assessmentType] : undefined) ??
          Target)
        : entry.icon,
    iconClass: tone.icon,
    progressClass: tone.progress,
    chevronClass: tone.chevron,
    progressPercent:
      child.questionCount > 0
        ? Math.min(100, Math.round((child.answeredCount / child.questionCount) * 100))
        : 0,
  }))
})
</script>

<template>
  <div
    v-if="loading && entryRows.length === 0"
    class="flex min-h-44 items-center justify-center border-t border-base-200"
  >
    <span class="loading loading-spinner loading-xs text-base-content/40"></span>
  </div>

  <div
    v-else-if="entryRows.length === 0"
    class="flex min-h-44 items-center justify-center border-t border-base-200 px-4 text-center"
  >
    <p class="text-sm text-base-content/65">{{ subjectName }} 暂无可用练习内容</p>
  </div>

  <template v-else>
    <!-- 切换科目加载期间保留上一科目内容:降透明提示更新中,点击由 loading 拦截 -->
    <div
      class="relative border-t border-base-200 px-4 py-3 transition-opacity"
      :class="loading ? 'opacity-50' : 'opacity-100'"
    >
      <span
        v-if="loading"
        class="absolute right-3 top-3 loading loading-spinner loading-xs text-base-content/40"
        aria-hidden="true"
      ></span>
      <div class="grid grid-cols-4 gap-1.5">
        <button
          v-for="entry in entryRows"
          :key="entry.type"
          class="flex min-w-0 flex-col items-center rounded-xl px-1 py-2 text-center transition-colors"
          :class="
            activeEntry?.type === entry.type
              ? `ring-1 ${entryToneStyles[entry.tone].active}`
              : 'bg-base-200/45 text-base-content/60 active:bg-base-200/75'
          "
          type="button"
          :aria-pressed="activeEntry?.type === entry.type"
          @click="emit('select-entry', entry.type)"
        >
          <span
            class="flex size-7 items-center justify-center rounded-full"
            :class="entryToneStyles[entry.tone].icon"
          >
            <component :is="entry.icon" :size="14" />
          </span>
          <span class="mt-1.5 block max-w-full truncate text-[11px] font-semibold">
            {{ entry.name }}
          </span>
        </button>
      </div>
    </div>

    <!-- AI 练习:静态还原面板(占位数据),后续由 AI 训练接口数据替换 -->
    <AiPracticePanel v-if="activeEntry?.type === 'aiPractice'" :subject-name="props.subjectName" />

    <!-- 题集列表保持统一最小高度:空态/单条/多条之间切换时卡片不塌陷、不跳动 -->
    <div
      v-else-if="activeEntryChildren.length > 0"
      class="min-h-44 min-w-0 divide-y divide-base-200 border-t border-base-200"
    >
      <button
        v-for="child in activeEntryChildren"
        :key="child.paperId"
        class="group flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition active:bg-base-200/50"
        type="button"
        :aria-label="`${child.name}，进入详情`"
        @click="emit('start-paper', child)"
      >
        <span
          class="flex size-9 shrink-0 items-center justify-center rounded-xl"
          :class="child.iconClass"
        >
          <component :is="child.icon" :size="17" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex min-w-0 items-center justify-between gap-2">
            <span class="truncate text-sm font-medium">{{ child.name }}</span>
            <span class="shrink-0 text-xs text-base-content/65 tabular-nums">
              {{ child.answeredCount }}/{{ child.questionCount }}
            </span>
          </span>
          <span class="mt-2 flex items-center">
            <span
              class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-base-200"
              aria-hidden="true"
            >
              <span
                class="block h-full rounded-full transition-all"
                :class="child.progressClass"
                :style="{ width: `${child.progressPercent}%` }"
              ></span>
            </span>
          </span>
        </span>
        <ChevronRight
          :size="17"
          class="shrink-0 text-base-content/30 transition group-active:translate-x-0.5"
          :class="child.chevronClass"
        />
      </button>
    </div>

    <div
      v-else-if="activeEntry"
      class="flex min-h-44 items-center justify-center border-t border-base-200 px-5 text-center"
    >
      <p class="text-xs leading-relaxed text-base-content/45">
        {{ activeEntry.description || '当前入口暂无可用内容' }}
      </p>
    </div>
  </template>
</template>
