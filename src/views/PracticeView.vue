<script setup lang="ts">
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  ClipboardList,
  EyeOff,
  FileStack,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
} from '@lucide/vue'
import { differenceInCalendarDays } from 'date-fns'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import BaseModal from '@/components/common/BaseModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PracticePlanModal from '@/components/common/PracticePlanModal.vue'
import PracticeSettingsContent from '@/components/common/PracticeSettingsContent.vue'
import { fetchPracticeEntries, fetchPracticePlan } from '@/api/practice'
import { useAppStore } from '@/stores/app'
import type { PracticeEntry, PracticeEntryChild, PracticePlan } from '@/types/domain'

const router = useRouter()
const app = useAppStore()
const examDate = new Date('2026-10-20T00:00:00+08:00')

const settingsModalOpen = ref(false)
const subjectPanelOpen = ref(false)
const planModalOpen = ref(false)
const plan = ref<PracticePlan | null>(null)
const planLoading = ref(false)

const subjectOrder = ref<string[]>([])
const hiddenSubjectIds = ref<Set<string>>(new Set())
const activeSubjectCode = ref('')
const expandedEntryKey = ref('')

const entries = ref<PracticeEntry[]>([])
const entriesLoading = ref(false)

type EntryTone = 'primary' | 'secondary' | 'accent' | 'info'

const entryStyles: Record<string, { tone: EntryTone; icon: typeof FileStack }> = {
  practice: { tone: 'primary', icon: FileStack },
  pastExam: { tone: 'secondary', icon: BookOpenCheck },
  mock: { tone: 'accent', icon: ClipboardList },
  ai: { tone: 'info', icon: Sparkles },
}

function entryStyle(type: string) {
  return entryStyles[type] ?? { tone: 'primary' as EntryTone, icon: FileStack }
}

const planMajorName = computed(() => plan.value?.majorName ?? '')
const planMajorCode = computed(() => plan.value?.majorCode ?? '')
const planSubjects = computed(() => plan.value?.subjects ?? [])

const hasPracticePlan = computed(() => planSubjects.value.length > 0)
const daysUntilExam = computed(() => Math.max(0, differenceInCalendarDays(examDate, new Date())))
const examCountdownText = computed(() => `2026年10月20日 · 还剩 ${daysUntilExam.value} 天`)

const orderedSubjects = computed(() => {
  const orderMap = new Map(subjectOrder.value.map((code, index) => [code, index]))
  return [...planSubjects.value].sort((a, b) => {
    const aIndex = orderMap.get(a.code) ?? Number.MAX_SAFE_INTEGER
    const bIndex = orderMap.get(b.code) ?? Number.MAX_SAFE_INTEGER
    return aIndex - bIndex
  })
})

const visibleSubjects = computed(() =>
  orderedSubjects.value.filter((subject) => !hiddenSubjectIds.value.has(subject.code)),
)

const activeSubject = computed(
  () =>
    visibleSubjects.value.find((subject) => subject.code === activeSubjectCode.value) ??
    visibleSubjects.value[0],
)

const entryRows = computed(() =>
  entries.value.map((entry) => ({
    ...entry,
    ...entryStyle(entry.type),
  })),
)
const activeEntry = computed(
  () =>
    entryRows.value.find((entry) => entry.type === expandedEntryKey.value) ?? entryRows.value[0],
)

function entryToneClasses(tone: EntryTone) {
  const map = {
    accent: 'bg-accent/15 text-accent',
    info: 'bg-info/10 text-info',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
  }
  return map[tone]
}

function selectSubject(code: string) {
  activeSubjectCode.value = code
  expandedEntryKey.value = ''
}

function selectEntry(key: string) {
  expandedEntryKey.value = key
}

function syncSubjectOrder() {
  const codes = planSubjects.value.map((subject) => subject.code)
  subjectOrder.value = [
    ...subjectOrder.value.filter((code) => codes.includes(code)),
    ...codes.filter((code) => !subjectOrder.value.includes(code)),
  ]

  hiddenSubjectIds.value = new Set(
    [...hiddenSubjectIds.value].filter((code) => codes.includes(code)),
  )

  const visibleIds = subjectOrder.value.filter((code) => !hiddenSubjectIds.value.has(code))
  if (!activeSubjectCode.value || !visibleIds.includes(activeSubjectCode.value)) {
    activeSubjectCode.value = visibleIds[0] ?? ''
  }
}

function moveSubject(code: string, direction: -1 | 1) {
  const codes = [...subjectOrder.value]
  const index = codes.indexOf(code)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= codes.length) return

  const [current] = codes.splice(index, 1)
  if (!current) return
  codes.splice(nextIndex, 0, current)
  subjectOrder.value = codes
}

function toggleSubjectVisibility(code: string) {
  const nextIds = new Set(hiddenSubjectIds.value)
  if (nextIds.has(code)) {
    nextIds.delete(code)
  } else {
    nextIds.add(code)
  }
  hiddenSubjectIds.value = nextIds
  syncSubjectOrder()
}

function startEntryPaper(child: PracticeEntryChild) {
  if (!child.paperId) return
  app.startPracticeSession([child.paperId])
  router.push({
    name: 'session',
    params: { paperId: child.paperId },
    query: { subject: activeSubject.value?.name ?? '' },
  })
}

async function loadEntries() {
  const subject = activeSubject.value
  if (!subject) {
    entries.value = []
    return
  }
  entries.value = []
  entriesLoading.value = true
  try {
    entries.value = await fetchPracticeEntries(subject.code)
    if (!entries.value.some((entry) => entry.type === expandedEntryKey.value)) {
      expandedEntryKey.value = entries.value[0]?.type ?? ''
    }
  } catch {
    entries.value = []
    expandedEntryKey.value = ''
  } finally {
    entriesLoading.value = false
  }
}

async function loadPlan() {
  planLoading.value = true
  try {
    plan.value = await fetchPracticePlan()
  } catch {
    plan.value = null
  } finally {
    planLoading.value = false
  }
}

function handlePlanUpdated(updated: PracticePlan) {
  plan.value = updated
}

onMounted(() => {
  void loadPlan()
})

watch(
  () => planSubjects.value.map((subject) => subject.code).join('|'),
  () => {
    syncSubjectOrder()
  },
  { immediate: true },
)

watch(
  () => activeSubject.value?.code ?? '',
  () => {
    expandedEntryKey.value = ''
    void loadEntries()
  },
  { immediate: true },
)
</script>

<template>
  <section
    class="flex min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full flex-col gap-5 overflow-x-hidden"
  >
    <header class="flex min-w-0 items-start justify-between gap-3">
      <div class="min-w-0 flex-1">
        <h1 class="text-2xl font-semibold leading-tight">练习</h1>
        <p class="mt-1 truncate text-sm text-base-content/50">
          <template v-if="planLoading">正在同步练习计划…</template>
          <template v-else-if="hasPracticePlan">
            {{ planMajorName || '当前计划' }}{{ planMajorCode ? ` · ${planMajorCode}` : '' }} · 还剩
            {{ daysUntilExam }} 天
          </template>
          <template v-else>设置报考专业与科目后开始练习</template>
        </p>
      </div>

      <div class="flex shrink-0 items-center gap-1.5">
        <button
          class="btn h-9 min-h-9 rounded-xl border-base-200 bg-base-100 px-2.5 text-xs font-medium"
          type="button"
          aria-label="练习计划"
          @click="planModalOpen = true"
        >
          <SlidersHorizontal :size="15" />
          计划
        </button>
        <button
          class="btn h-9 min-h-9 rounded-xl border-base-200 bg-base-100 px-2.5 text-xs font-medium"
          type="button"
          aria-label="练习设置"
          @click="settingsModalOpen = true"
        >
          <Settings2 :size="15" />
          设置
        </button>
      </div>
    </header>

    <section v-if="planLoading" class="overflow-hidden rounded-2xl border border-base-200">
      <EmptyState :icon="Target" title="加载中" description="正在获取练习计划…" />
    </section>

    <section
      v-else-if="!hasPracticePlan"
      class="overflow-hidden rounded-2xl border border-base-200"
    >
      <EmptyState
        :icon="Target"
        title="暂无练习计划"
        description="先选择报考专业与刷题科目。"
        action-label="设置计划"
        @action="planModalOpen = true"
      />
    </section>

    <template v-else>
      <section class="min-w-0 max-w-full overflow-hidden">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 class="text-lg font-semibold">选择科目</h2>
            <p class="mt-0.5 text-xs text-base-content/45">切换后展示对应的练习内容</p>
          </div>
          <button
            class="btn btn-ghost h-8 min-h-8 shrink-0 gap-1 rounded-lg px-2 text-xs font-medium text-base-content/55"
            type="button"
            aria-label="科目管理"
            @click="subjectPanelOpen = true"
          >
            <SlidersHorizontal :size="15" />
            管理
          </button>
        </div>

        <div
          class="flex min-w-0 gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <button
            v-for="subject in visibleSubjects"
            :key="subject.code"
            class="max-w-[10rem] shrink-0 rounded-xl border px-3 py-2 text-sm font-medium transition-colors"
            :class="
              activeSubject?.code === subject.code
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-base-200 bg-base-100 text-base-content/65 active:bg-base-200/60'
            "
            type="button"
            :aria-pressed="activeSubject?.code === subject.code"
            @click="selectSubject(subject.code)"
          >
            <span class="block truncate">{{ subject.name }}</span>
          </button>
        </div>
      </section>

      <section
        v-if="!activeSubject"
        class="overflow-hidden rounded-2xl border border-base-200 bg-base-100"
      >
        <EmptyState
          :icon="EyeOff"
          title="所有科目已隐藏"
          description="在科目管理中恢复需要展示的科目。"
          action-label="管理科目"
          @action="subjectPanelOpen = true"
        />
      </section>

      <section v-else class="min-w-0 max-w-full overflow-hidden">
        <div class="mb-3 flex items-center justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold">练习方式</h2>
            <p class="mt-0.5 truncate text-xs text-base-content/45">{{ activeSubject.name }}</p>
          </div>
          <span class="shrink-0 text-xs text-base-content/40">{{ entryRows.length }} 种</span>
        </div>

        <div v-if="entriesLoading" class="flex min-h-44 items-center justify-center">
          <span class="loading loading-spinner loading-sm"></span>
        </div>

        <EmptyState
          v-else-if="entryRows.length === 0"
          :icon="Target"
          title="暂无练习入口"
          :description="`${activeSubject.name} 暂无可用练习内容。`"
        />

        <template v-else>
          <div class="grid grid-cols-4 gap-2">
            <button
              v-for="entry in entryRows"
              :key="entry.type"
              class="flex min-w-0 flex-col items-center rounded-xl border px-1.5 py-2.5 text-center transition-colors"
              :class="
                activeEntry?.type === entry.type
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-base-200 bg-base-100 text-base-content/60 active:bg-base-200/60'
              "
              type="button"
              :aria-pressed="activeEntry?.type === entry.type"
              @click="selectEntry(entry.type)"
            >
              <span
                class="flex size-8 items-center justify-center rounded-full"
                :class="entryToneClasses(entry.tone)"
              >
                <component :is="entry.icon" :size="16" />
              </span>
              <span class="mt-1.5 block max-w-full truncate text-xs font-semibold">
                {{ entry.name }}
              </span>
            </button>
          </div>

          <div
            v-if="activeEntry"
            class="mt-3 overflow-hidden rounded-2xl border border-base-200 bg-base-100"
          >
            <div class="flex min-w-0 items-center gap-3 border-b border-base-200 px-4 py-3.5">
              <span
                class="flex size-9 shrink-0 items-center justify-center rounded-full"
                :class="entryToneClasses(activeEntry.tone)"
              >
                <component :is="activeEntry.icon" :size="17" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-semibold">{{ activeEntry.name }}</span>
                <span class="mt-0.5 block truncate text-xs text-base-content/45">
                  {{ activeEntry.description || activeEntry.name }}
                </span>
              </span>
            </div>

            <div
              v-if="activeEntry.children && activeEntry.children.length > 0"
              class="divide-y divide-base-200"
            >
              <button
                v-for="child in activeEntry.children"
                :key="child.paperId"
                class="group flex w-full min-w-0 items-center gap-3 px-4 py-3.5 text-left transition active:bg-base-200/50"
                type="button"
                @click="startEntryPaper(child)"
              >
                <span
                  class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-base-200/70 text-primary"
                >
                  <FileStack :size="15" />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium">{{ child.name }}</span>
                  <span class="mt-1 flex items-center gap-2">
                    <progress
                      class="progress progress-primary h-1.5 min-w-0 flex-1"
                      :value="child.answeredCount"
                      :max="child.questionCount || 1"
                    ></progress>
                    <span class="shrink-0 text-[11px] text-base-content/40">
                      {{ child.answeredCount }}/{{ child.questionCount }} 题
                    </span>
                  </span>
                </span>
                <span
                  class="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"
                >
                  开始
                  <ArrowRight
                    :size="12"
                    class="transition-transform group-active:translate-x-0.5"
                  />
                </span>
              </button>
            </div>

            <div
              v-else
              class="flex min-h-28 flex-col items-center justify-center px-5 py-6 text-center"
            >
              <span class="text-sm font-medium">当前暂无可用内容</span>
              <span class="mt-1 text-xs text-base-content/45">{{ activeEntry.description }}</span>
            </div>
          </div>
        </template>
      </section>
    </template>

    <BaseModal v-model="subjectPanelOpen">
      <div>
        <h3 class="text-base font-semibold">科目管理</h3>
        <p class="mt-1 text-xs text-base-content/50">勾选显示，使用箭头调整顺序</p>
      </div>

      <div class="mt-3 border-y border-base-200 divide-y divide-base-200">
        <div
          v-for="(subject, index) in orderedSubjects"
          :key="subject.code"
          class="flex min-h-12 min-w-0 items-center gap-2 py-1.5"
        >
          <label class="flex size-8 shrink-0 cursor-pointer items-center justify-center">
            <input
              type="checkbox"
              class="checkbox checkbox-xs checkbox-primary"
              :checked="!hiddenSubjectIds.has(subject.code)"
              :aria-label="`${subject.name}显示状态`"
              @change="toggleSubjectVisibility(subject.code)"
            />
          </label>

          <button
            class="min-w-0 flex-1 truncate text-left text-sm font-medium"
            :class="[
              activeSubject?.code === subject.code ? 'text-primary' : '',
              hiddenSubjectIds.has(subject.code) ? 'text-base-content/35' : '',
            ]"
            type="button"
            @click="selectSubject(subject.code)"
          >
            {{ subject.name }}
          </button>

          <div class="flex shrink-0 items-center gap-0.5">
            <button
              class="btn btn-square btn-ghost btn-xs text-base-content/45"
              type="button"
              aria-label="上移科目"
              :disabled="index === 0"
              @click="moveSubject(subject.code, -1)"
            >
              <ArrowUp :size="15" />
            </button>
            <button
              class="btn btn-square btn-ghost btn-xs text-base-content/45"
              type="button"
              aria-label="下移科目"
              :disabled="index === orderedSubjects.length - 1"
              @click="moveSubject(subject.code, 1)"
            >
              <ArrowDown :size="15" />
            </button>
          </div>
        </div>

        <EmptyState
          v-if="orderedSubjects.length === 0"
          :icon="Target"
          title="暂无可管理科目"
          description="暂无练习计划科目。"
        />
      </div>
    </BaseModal>

    <PracticeSettingsContent v-model="settingsModalOpen" />

    <PracticePlanModal v-model="planModalOpen" :plan="plan" @updated="handlePlanUpdated" />
  </section>
</template>
