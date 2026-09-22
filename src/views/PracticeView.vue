<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  EyeOff,
  FileText,
  Flame,
  GraduationCap,
  ListChecks,
  Pencil,
  Settings2,
  ShieldAlert,
  Sparkles,
  Target,
} from '@lucide/vue'
import { differenceInCalendarDays, format } from 'date-fns'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import logoPassitai from '@/assets/icons/icon-passitai.svg'
import BaseModal from '@/components/common/BaseModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PracticePlanModal from '@/components/common/PracticePlanModal.vue'
import PracticeSettingsContent from '@/components/common/PracticeSettingsContent.vue'
import { fetchPracticeEntries, fetchPracticePlan } from '@/api/practice'
import { useAppStore } from '@/stores/app'
import type {
  PracticeEntry,
  PracticeEntryChild,
  PracticePlan,
  PracticePlanSubject,
} from '@/types/domain'

const router = useRouter()
const app = useAppStore()

const planMetadataPlaceholders: Record<string, { educationLevel?: string; nextExamDate?: string }> =
  {
    '120206': {
      educationLevel: '本科',
      nextExamDate: '2026-10-25T00:00:00+08:00',
    },
  }

const settingsModalOpen = ref(false)
const subjectPanelOpen = ref(false)
const subjectPickerOpen = ref(false)
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

const entryStyles: Record<string, { tone: EntryTone; icon: typeof ListChecks }> = {
  practice: { tone: 'primary', icon: ListChecks },
  pastExam: { tone: 'secondary', icon: BookOpenCheck },
  mock: { tone: 'accent', icon: ClipboardCheck },
  ai: { tone: 'info', icon: Sparkles },
}

function entryStyle(type: string) {
  return entryStyles[type] ?? { tone: 'primary' as EntryTone, icon: ListChecks }
}

const planMajorName = computed(() => plan.value?.majorName ?? '')
const planMajorCode = computed(() => plan.value?.majorCode ?? '')
const planSubjects = computed(() => plan.value?.subjects ?? [])
const placeholderPlanMetadata = computed(() => planMetadataPlaceholders[planMajorCode.value])
const planEducationLevel = computed(
  () => plan.value?.educationLevel || placeholderPlanMetadata.value?.educationLevel || '',
)
const nextExamDate = computed(() => {
  const dateValue = plan.value?.nextExamDate || placeholderPlanMetadata.value?.nextExamDate
  if (!dateValue) return null
  const parsedDate = new Date(dateValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
})

const hasPracticePlan = computed(() => planSubjects.value.length > 0)
const daysUntilExam = computed(() => {
  if (!nextExamDate.value) return null
  return Math.max(0, differenceInCalendarDays(nextExamDate.value, new Date()))
})
const nextExamDateText = computed(() =>
  nextExamDate.value ? format(nextExamDate.value, 'yyyy年M月d日') : '',
)

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

const practiceChildVisuals = [
  { icon: Target, iconClass: 'bg-primary/10 text-primary', progressClass: 'bg-primary' },
  { icon: Flame, iconClass: 'bg-warning/10 text-warning', progressClass: 'bg-warning' },
  { icon: ShieldAlert, iconClass: 'bg-error/10 text-error', progressClass: 'bg-error' },
]

function childVisual(type: string, index: number) {
  if (type === 'practice') {
    return practiceChildVisuals[index] ?? practiceChildVisuals[0]!
  }

  const map = {
    ai: { icon: Sparkles, iconClass: 'bg-info/10 text-info', progressClass: 'bg-info' },
    mock: {
      icon: ClipboardCheck,
      iconClass: 'bg-accent/10 text-accent',
      progressClass: 'bg-accent',
    },
    pastExam: {
      icon: FileText,
      iconClass: 'bg-secondary/10 text-secondary',
      progressClass: 'bg-secondary',
    },
  }

  return (
    map[type as keyof typeof map] ?? {
      icon: Target,
      iconClass: 'bg-primary/10 text-primary',
      progressClass: 'bg-primary',
    }
  )
}

const activeEntryChildren = computed(() =>
  (activeEntry.value?.children ?? []).map((child, index) => ({
    ...child,
    ...childVisual(activeEntry.value?.type ?? '', index),
    progressPercent:
      child.questionCount > 0
        ? Math.min(100, Math.round((child.answeredCount / child.questionCount) * 100))
        : 0,
  })),
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
  subjectPickerOpen.value = false
}

function subjectCreditsText(subject: PracticePlanSubject) {
  return typeof subject.credits === 'number' ? `${subject.credits} 学分` : ''
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
    class="flex min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden"
  >
    <header class="flex h-9 shrink-0 items-center">
      <img :src="logoPassitai" alt="Passitai" class="h-8 w-auto" />
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
      <section class="overflow-hidden rounded-2xl border border-base-200 bg-base-100">
        <div class="px-4 py-4">
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex min-w-0 items-center gap-2">
                <h2 class="truncate text-lg font-semibold">{{ planMajorName }}</h2>
                <span
                  v-if="planEducationLevel"
                  class="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
                >
                  {{ planEducationLevel }}
                </span>
              </div>
              <p v-if="planMajorCode" class="mt-1.5 text-xs text-base-content/45">
                专业代码 {{ planMajorCode }}
              </p>
            </div>
            <span
              class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-secondary"
            >
              <GraduationCap :size="17" />
            </span>
          </div>

          <div
            v-if="nextExamDate"
            class="mt-4 grid grid-cols-2 overflow-hidden rounded-xl bg-base-200/40"
          >
            <div class="border-r border-base-200 px-3 py-2.5">
              <p class="flex items-center gap-1.5 text-[11px] text-base-content/45">
                <span class="size-1.5 rounded-full bg-info"></span>
                考试时间
              </p>
              <p class="mt-1.5 text-sm font-semibold tabular-nums">{{ nextExamDateText }}</p>
            </div>
            <div class="px-3 py-2.5 text-right">
              <p class="flex items-center justify-end gap-1.5 text-[11px] text-base-content/45">
                <span class="size-1.5 rounded-full bg-primary"></span>
                距离考试
              </p>
              <p class="mt-0.5 text-sm text-base-content/65">
                <strong class="text-lg font-semibold text-primary tabular-nums">
                  {{ daysUntilExam }}
                </strong>
                天
              </p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 divide-x divide-base-200 border-t border-base-200">
          <button
            class="flex h-10 items-center justify-center gap-1.5 text-xs font-medium text-base-content/65 transition active:bg-base-200/50"
            type="button"
            aria-label="刷题计划"
            @click="planModalOpen = true"
          >
            <ClipboardList :size="15" />
            刷题计划
          </button>
          <button
            class="flex h-10 items-center justify-center gap-1.5 text-xs font-medium text-base-content/65 transition active:bg-base-200/50"
            type="button"
            aria-label="练习设置"
            @click="settingsModalOpen = true"
          >
            <Settings2 :size="15" />
            练习设置
          </button>
        </div>
      </section>

      <section class="overflow-hidden rounded-2xl border border-base-200 bg-base-100">
        <div class="flex min-w-0 items-center justify-between gap-3 px-4 py-3">
          <div class="flex min-w-0 items-center gap-2.5">
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary/10 text-secondary"
            >
              <BookOpenCheck :size="16" />
            </span>
            <span class="truncate text-sm font-medium">刷题科目</span>
            <span
              class="shrink-0 rounded-full bg-secondary/10 px-2 py-0.5 text-xs font-semibold text-secondary"
            >
              {{ planSubjects.length }}个
            </span>
          </div>
          <button
            class="flex shrink-0 items-center gap-1 text-xs font-medium text-primary"
            type="button"
            aria-label="科目管理"
            @click="subjectPanelOpen = true"
          >
            <Pencil :size="13" />
            管理
          </button>
        </div>

        <button
          v-if="activeSubject"
          class="flex h-12 w-full min-w-0 items-center border-t border-base-200 px-4 text-left"
          type="button"
          aria-label="选择练习科目"
          @click="subjectPickerOpen = true"
        >
          <span class="mr-3 h-6 w-1 shrink-0 rounded-full bg-secondary" aria-hidden="true"></span>
          <span class="min-w-0 flex-1 truncate text-sm font-semibold">{{
            activeSubject.name
          }}</span>
          <ChevronDown :size="16" class="ml-3 shrink-0 text-base-content/45" />
        </button>

        <div v-if="activeSubject" class="border-t border-base-200 px-3 py-3">
          <div v-if="entriesLoading" class="flex min-h-14 items-center justify-center">
            <span class="loading loading-spinner loading-xs"></span>
          </div>

          <div v-else-if="entryRows.length > 0" class="grid grid-cols-4 gap-1.5">
            <button
              v-for="entry in entryRows"
              :key="entry.type"
              class="flex min-w-0 flex-col items-center rounded-xl px-1 py-2 text-center transition-colors"
              :class="
                activeEntry?.type === entry.type
                  ? 'bg-primary/10 text-primary ring-1 ring-primary/40'
                  : 'bg-base-200/45 text-base-content/60 active:bg-base-200/75'
              "
              type="button"
              :aria-pressed="activeEntry?.type === entry.type"
              @click="selectEntry(entry.type)"
            >
              <span
                class="flex size-7 items-center justify-center rounded-full"
                :class="entryToneClasses(entry.tone)"
              >
                <component :is="entry.icon" :size="14" />
              </span>
              <span class="mt-1.5 block max-w-full truncate text-[11px] font-semibold">
                {{ entry.name }}
              </span>
            </button>
          </div>

          <p
            v-else-if="!entriesLoading"
            class="rounded-xl bg-base-200/35 px-3 py-3 text-center text-xs text-base-content/45"
          >
            暂无可用练习方式
          </p>
        </div>

        <div v-if="!activeSubject" class="border-t border-base-200">
          <EmptyState
            :icon="EyeOff"
            title="所有科目已隐藏"
            description="在科目管理中恢复需要展示的科目。"
            action-label="管理科目"
            @action="subjectPanelOpen = true"
          />
        </div>

        <div v-else-if="!entriesLoading && entryRows.length === 0" class="border-t border-base-200">
          <EmptyState
            :icon="Target"
            title="暂无练习入口"
            :description="`${activeSubject.name} 暂无可用练习内容。`"
          />
        </div>

        <div v-else-if="activeEntry" class="min-w-0 border-t border-base-200">
          <div v-if="activeEntryChildren.length > 0" class="divide-y divide-base-200">
            <button
              v-for="child in activeEntryChildren"
              :key="child.paperId"
              class="group flex w-full min-w-0 items-center gap-3 px-4 py-3 text-left transition active:bg-base-200/50"
              type="button"
              :aria-label="`${child.name}，进入详情`"
              @click="startEntryPaper(child)"
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
                  <span class="shrink-0 text-[11px] text-base-content/40 tabular-nums">
                    {{ child.answeredCount }}/{{ child.questionCount }}
                  </span>
                </span>
                <span class="mt-2 flex items-center gap-2">
                  <span class="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-base-200">
                    <span
                      class="block h-full rounded-full transition-all"
                      :class="child.progressClass"
                      :style="{ width: `${child.progressPercent}%` }"
                    ></span>
                  </span>
                  <span
                    class="w-7 shrink-0 text-right text-[10px] text-base-content/35 tabular-nums"
                  >
                    {{ child.progressPercent }}%
                  </span>
                </span>
              </span>
              <ChevronRight
                :size="17"
                class="shrink-0 text-base-content/25 transition group-active:translate-x-0.5 group-active:text-primary"
              />
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
          class="flex min-h-14 min-w-0 items-center gap-2 py-1.5"
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
            class="min-w-0 flex-1 text-left"
            :class="[
              activeSubject?.code === subject.code ? 'text-primary' : '',
              hiddenSubjectIds.has(subject.code) ? 'text-base-content/35' : '',
            ]"
            type="button"
            @click="selectSubject(subject.code)"
          >
            <span class="block truncate text-sm font-medium">{{ subject.name }}</span>
            <span
              v-if="subject.code || subjectCreditsText(subject)"
              class="mt-0.5 block truncate text-[11px] text-base-content/40"
            >
              <template v-if="subject.code">{{ subject.code }}</template>
              <template v-if="subject.code && subjectCreditsText(subject)"> · </template>
              <template v-if="subjectCreditsText(subject)">
                {{ subjectCreditsText(subject) }}
              </template>
            </span>
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

    <BaseModal v-model="subjectPickerOpen">
      <h3 class="text-base font-semibold">选择刷题科目</h3>

      <div class="mt-3 border-y border-base-200 divide-y divide-base-200">
        <button
          v-for="subject in visibleSubjects"
          :key="subject.code"
          class="flex min-h-12 w-full min-w-0 items-center gap-3 py-2 text-left"
          type="button"
          :aria-pressed="activeSubject?.code === subject.code"
          @click="selectSubject(subject.code)"
        >
          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm font-medium">{{ subject.name }}</span>
            <span v-if="subject.code" class="mt-0.5 block text-[11px] text-base-content/40">
              {{ subject.code }}
            </span>
          </span>
          <span
            v-if="activeSubject?.code === subject.code"
            class="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
          >
            <Check :size="14" :stroke-width="2.5" />
          </span>
        </button>
      </div>
    </BaseModal>

    <PracticeSettingsContent v-model="settingsModalOpen" />

    <PracticePlanModal v-model="planModalOpen" :plan="plan" @updated="handlePlanUpdated" />
  </section>
</template>
