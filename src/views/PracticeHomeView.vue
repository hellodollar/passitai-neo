<script setup lang="ts">
import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  EyeOff,
  GraduationCap,
  Hourglass,
  ListChecks,
  Settings2,
  Sparkles,
  Target,
} from '@lucide/vue'
import { differenceInCalendarDays, format } from 'date-fns'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import logoPassitai from '@/assets/icons/icon-passitai.svg'
import BaseModal from '@/components/common/BaseModal.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import StudyPlanModal from '@/components/practice/StudyPlanModal.vue'
import PracticeSettingsModal from '@/components/settings/PracticeSettingsModal.vue'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { fetchPracticeEntries } from '@/api/practice'
import { fetchPlan } from '@/api/plan'
import { fetchMajorOptions, fetchSubjectOptions } from '@/api/options'
import { ROUTE_NAMES } from '@/constants/app'
import { BASELINE_CHILD_ICONS } from '@/constants/practice-icons'
import { useAuthStore } from '@/stores/auth'
import { usePracticeStore } from '@/stores/practice'
import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { homeSelection, readBrowseState, writeBrowseState } from '@/utils/browse-state'
import { readPracticeRecord } from '@/utils/practice-record'
import { applyLocalPracticeProgress } from '@/utils/practice-progress'
import type { PracticeEntry, PracticeEntryChild, StudyPlan } from '@/types'

const router = useRouter()
const route = useRoute()
const practice = usePracticeStore()
const auth = useAuthStore()
const browseScroll = useBrowseScroll(
  () => auth.session?.user.id ?? '',
  () => 'home',
)
const initialBrowse = readBrowseState(auth.session?.user.id ?? '', 'home')
const initialSelection = homeSelection(route.query, initialBrowse)
const { records, refresh: refreshLocalRecords } = useLocalPracticeRecords()
const activeSubjectId = ref('')

const settingsModalOpen = ref(false)
const subjectPanelOpen = ref(false)
const planModalOpen = ref(false)
const plan = ref<StudyPlan | null>(null)
const planLoading = ref(false)

const subjectOrder = ref<string[]>(initialBrowse.subjectOrder)
const hiddenSubjectCodes = ref<Set<string>>(new Set(initialBrowse.hiddenSubjectCodes))
const activeSubjectCode = ref(initialSelection.subjectCode)
const expandedEntryKey = ref(initialSelection.entry)

const entries = ref<PracticeEntry[]>([])
const entriesLoading = ref(false)

// 科目 chips 单行横滑，右侧渐隐提示是否还有未滑出的科目
const chipsRow = ref<HTMLElement | null>(null)
const chipsCanScrollRight = ref(false)

function updateChipsScrollHint() {
  const el = chipsRow.value
  if (!el) {
    chipsCanScrollRight.value = false
    return
  }
  chipsCanScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 1
}

type EntryTone = 'primary' | 'secondary' | 'accent' | 'ai'

const entryStyles: Record<PracticeEntry['type'], { tone: EntryTone; icon: typeof ListChecks }> = {
  baseline: { tone: 'primary', icon: ListChecks },
  pastExam: { tone: 'secondary', icon: BookOpenCheck },
  mock: { tone: 'accent', icon: ClipboardCheck },
  ai: { tone: 'ai', icon: Sparkles },
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
    icon: 'bg-fuchsia-50 text-fuchsia-700',
    active: 'bg-fuchsia-50 text-fuchsia-700 ring-fuchsia-300',
    progress: 'bg-fuchsia-600',
    chevron: 'group-active:text-fuchsia-700',
  },
}

function entryStyle(type: PracticeEntry['type']) {
  return entryStyles[type]
}

const planMajorName = computed(() => plan.value?.majorName ?? '')
const planMajorCode = computed(() => plan.value?.majorCode ?? '')
const planSubjects = computed(() => plan.value?.subjects ?? [])
const planEducationLevel = computed(() => plan.value?.educationLevel ?? '')
const nextExamDate = computed(() => {
  const dateValue = plan.value?.nextExamDate
  if (!dateValue) return null
  const parsedDate = new Date(dateValue)
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
})

const hasStudyPlan = computed(() => planSubjects.value.length > 0)
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
  orderedSubjects.value.filter((subject) => !hiddenSubjectCodes.value.has(subject.code)),
)

const activeSubject = computed(
  () =>
    visibleSubjects.value.find((subject) => subject.code === activeSubjectCode.value) ??
    visibleSubjects.value[0],
)

const localEntries = computed(() =>
  applyLocalPracticeProgress(
    entries.value,
    records.value,
    auth.session?.user.id ?? '',
    activeSubjectId.value,
  ),
)
const entryRows = computed(() =>
  localEntries.value.map((entry) => ({
    ...entry,
    ...entryStyle(entry.type),
  })),
)
const activeEntry = computed(
  () =>
    entryRows.value.find((entry) => entry.type === expandedEntryKey.value) ?? entryRows.value[0],
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

function entryToneClasses(tone: EntryTone) {
  return entryToneStyles[tone].icon
}

function selectSubject(code: string) {
  activeSubjectCode.value = code
  expandedEntryKey.value = 'baseline'
  persistHomeSelection()
}

function selectEntry(key: string) {
  expandedEntryKey.value = key
  persistHomeSelection()
}

function persistHomeSelection() {
  if (route.name !== ROUTE_NAMES.practiceHome) return
  const subjectCode = activeSubject.value?.code ?? ''
  const entry = expandedEntryKey.value || 'baseline'
  writeBrowseState(auth.session?.user.id ?? '', 'home', {
    subjectCode,
    entry,
    subjectOrder: subjectOrder.value,
    hiddenSubjectCodes: [...hiddenSubjectCodes.value],
  })
  if (route.query.subjectCode !== (subjectCode || undefined) || route.query.entry !== entry) {
    void router.replace({ query: { ...route.query, subjectCode: subjectCode || undefined, entry } })
  }
}

function syncSubjectOrder() {
  if (!plan.value) return
  const codes = planSubjects.value.map((subject) => subject.code)
  subjectOrder.value = [
    ...subjectOrder.value.filter((code) => codes.includes(code)),
    ...codes.filter((code) => !subjectOrder.value.includes(code)),
  ]

  hiddenSubjectCodes.value = new Set(
    [...hiddenSubjectCodes.value].filter((code) => codes.includes(code)),
  )

  const visibleCodes = subjectOrder.value.filter((code) => !hiddenSubjectCodes.value.has(code))
  if (!activeSubjectCode.value || !visibleCodes.includes(activeSubjectCode.value)) {
    activeSubjectCode.value = visibleCodes[0] ?? ''
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
  persistHomeSelection()
}

function toggleSubjectVisibility(code: string) {
  const nextCodes = new Set(hiddenSubjectCodes.value)
  if (nextCodes.has(code)) {
    nextCodes.delete(code)
  } else {
    nextCodes.add(code)
  }
  hiddenSubjectCodes.value = nextCodes
  syncSubjectOrder()
  persistHomeSelection()
}

function startEntryPaper(child: PracticeEntryChild) {
  if (!child.paperId || entriesLoading.value) return
  const returnTo = router.resolve({
    path: route.path,
    query: {
      ...route.query,
      subjectCode: activeSubject.value?.code || undefined,
      entry: expandedEntryKey.value || 'baseline',
    },
  }).fullPath
  practice.startSession()
  router.push({
    name: ROUTE_NAMES.practicePaper,
    params: { paperId: child.paperId },
    query: { subject: activeSubject.value?.name ?? '', returnTo },
  })
}

// 计划只有科目 code；进入题集前按专业解析真实 subjectId。
const subjectIdsByMajorCode = new Map<string, Map<string, string>>()
let entryLoadSequence = 0
let planLoadSequence = 0

async function getSubjectIdMap(majorCode: string) {
  if (!majorCode) return null
  const cached = subjectIdsByMajorCode.get(majorCode)
  if (cached) return cached

  const majors = await fetchMajorOptions({ code: majorCode })
  const majorId = majors.find((major) => major.code === majorCode)?.id
  if (!majorId) return null
  const subjects = await fetchSubjectOptions(majorId)
  const subjectIds = new Map(subjects.map((subject) => [subject.code, subject.id]))
  subjectIdsByMajorCode.set(majorCode, subjectIds)
  return subjectIds
}

async function loadEntries() {
  const sequence = ++entryLoadSequence
  const userId = auth.session?.user.id
  activeSubjectId.value = ''
  const subject = activeSubject.value
  if (!subject) {
    entries.value = []
    entriesLoading.value = false
    if (plan.value && !planLoading.value) void browseScroll.restore()
    return
  }
  entries.value = []
  entriesLoading.value = true
  try {
    const subjectIds = await getSubjectIdMap(planMajorCode.value)
    if (sequence !== entryLoadSequence) return
    const subjectId = subjectIds?.get(subject.code)
    if (!subjectId) return

    const loadedEntries = await fetchPracticeEntries(subjectId)
    if (sequence !== entryLoadSequence || auth.session?.user.id !== userId) return
    activeSubjectId.value = subjectId
    // 目录已给出真实科目及分类，可迁移这些题集的旧记录；不额外拉取作答接口。
    if (userId) {
      for (const entry of loadedEntries) {
        for (const child of entry.children ?? []) {
          readPracticeRecord({
            userId,
            paperId: child.paperId,
            source: 'practice',
            subjectId,
            paperType: entry.type,
          })
        }
      }
      refreshLocalRecords()
    }
    entries.value = loadedEntries
    if (!entries.value.some((entry) => entry.type === expandedEntryKey.value)) {
      expandedEntryKey.value = entries.value[0]?.type ?? ''
    }
    persistHomeSelection()
  } catch {
    if (sequence !== entryLoadSequence) return
    entries.value = []
  } finally {
    if (sequence === entryLoadSequence) {
      entriesLoading.value = false
      await nextTick()
      const selected = chipsRow.value?.querySelector<HTMLElement>('[aria-pressed="true"]')
      if (selected && chipsRow.value) {
        chipsRow.value.scrollLeft = Math.max(
          0,
          selected.offsetLeft - chipsRow.value.offsetLeft - 16,
        )
      }
      updateChipsScrollHint()
      void browseScroll.restore()
    }
  }
}

async function loadPlan() {
  const sequence = ++planLoadSequence
  planLoading.value = true
  try {
    const loadedPlan = await fetchPlan()
    if (sequence === planLoadSequence) plan.value = loadedPlan
  } catch {
    if (sequence === planLoadSequence) plan.value = null
  } finally {
    if (sequence === planLoadSequence) {
      planLoading.value = false
      if (!hasStudyPlan.value) void browseScroll.restore()
    }
  }
}

function handlePlanUpdated(updated: StudyPlan) {
  planLoadSequence++
  planLoading.value = false
  plan.value = updated
}

onMounted(() => {
  void loadPlan()
})

onBeforeUnmount(() => {
  planLoadSequence++
  entryLoadSequence++
})

watch([() => route.query.subjectCode, () => route.query.entry], () => {
  const selection = homeSelection(route.query, readBrowseState(auth.session?.user.id ?? '', 'home'))
  activeSubjectCode.value = selection.subjectCode
  expandedEntryKey.value = selection.entry
  syncSubjectOrder()
})

watch(
  () => auth.session?.user.id,
  (userId) => {
    planLoadSequence++
    entryLoadSequence++
    const state = readBrowseState(userId ?? '', 'home')
    const selection = homeSelection({}, state)
    browseScroll.reset()
    plan.value = null
    planLoading.value = false
    entries.value = []
    entriesLoading.value = false
    activeSubjectId.value = ''
    subjectIdsByMajorCode.clear()
    subjectOrder.value = state.subjectOrder
    hiddenSubjectCodes.value = new Set(state.hiddenSubjectCodes)
    activeSubjectCode.value = selection.subjectCode
    expandedEntryKey.value = selection.entry
    if (userId) void loadPlan()
  },
)

watch(
  () => planSubjects.value.map((subject) => subject.code).join('|'),
  () => {
    syncSubjectOrder()
  },
  { immediate: true },
)

watch(
  () => visibleSubjects.value.map((subject) => subject.code).join('|'),
  async () => {
    await nextTick()
    updateChipsScrollHint()
  },
  { immediate: true },
)

watch(
  () => [planMajorCode.value, activeSubject.value?.code ?? ''],
  () => {
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
      <EmptyState :icon="Hourglass" title="加载中" description="正在获取练习计划…" />
    </section>

    <section v-else-if="!hasStudyPlan" class="overflow-hidden rounded-2xl border border-base-200">
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
              <p class="mt-0.5 text-sm text-base-content/60">
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
            class="flex h-10 items-center justify-center gap-1.5 text-xs font-medium text-base-content/60 transition active:bg-base-200/50"
            type="button"
            aria-label="刷题计划"
            @click="planModalOpen = true"
          >
            <ClipboardList :size="15" />
            刷题计划
          </button>
          <button
            class="flex h-10 items-center justify-center gap-1.5 text-xs font-medium text-base-content/60 transition active:bg-base-200/50"
            type="button"
            aria-label="刷题设置"
            @click="settingsModalOpen = true"
          >
            <Settings2 :size="15" />
            刷题设置
          </button>
        </div>
      </section>

      <div class="flex items-end justify-between gap-3 px-0.5">
        <div class="flex items-baseline gap-2">
          <h2 class="text-[17px] font-semibold leading-tight">刷题科目</h2>
          <span class="text-xs text-base-content/45">{{ planSubjects.length }}个</span>
        </div>
        <button
          class="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary transition-opacity active:opacity-70"
          type="button"
          aria-label="科目管理"
          @click="subjectPanelOpen = true"
        >
          管理
          <ChevronRight :size="15" class="-mr-0.5 mt-px" />
        </button>
      </div>

      <section class="overflow-hidden rounded-2xl border border-base-200 bg-base-100">
        <div v-if="visibleSubjects.length > 0" class="relative">
          <div
            ref="chipsRow"
            class="no-scrollbar flex gap-2 overflow-x-auto px-4 py-3"
            @scroll.passive="updateChipsScrollHint"
          >
            <button
              v-for="subject in visibleSubjects"
              :key="subject.code"
              class="max-w-[9.5rem] shrink-0 truncate rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors"
              :class="
                activeSubject?.code === subject.code
                  ? 'bg-primary text-primary-content'
                  : 'bg-base-200/60 text-base-content/60 active:bg-base-200'
              "
              type="button"
              :aria-pressed="activeSubject?.code === subject.code"
              @click="selectSubject(subject.code)"
            >
              {{ subject.name }}
            </button>
          </div>
          <!-- 右侧渐隐提示还有更多科目可横滑 -->
          <span
            v-if="chipsCanScrollRight"
            class="pointer-events-none absolute inset-y-2 right-0 w-9 rounded-r-2xl bg-gradient-to-l from-base-100 via-base-100/85 to-transparent"
            aria-hidden="true"
          ></span>
        </div>

        <div v-if="!activeSubject">
          <EmptyState
            :icon="EyeOff"
            title="所有科目已隐藏"
            description="在科目管理中恢复需要展示的科目。"
            action-label="管理科目"
            @action="subjectPanelOpen = true"
          />
        </div>

        <div
          v-else-if="entriesLoading"
          class="flex min-h-20 items-center justify-center border-t border-base-200"
        >
          <span class="loading loading-spinner loading-xs text-base-content/40"></span>
        </div>

        <div v-else-if="entryRows.length === 0" class="border-t border-base-200">
          <EmptyState
            :icon="Target"
            title="暂无练习入口"
            :description="`${activeSubject.name} 暂无可用练习内容。`"
          />
        </div>

        <template v-else>
          <div class="border-t border-base-200 px-4 py-3">
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
          </div>

          <div
            v-if="activeEntryChildren.length > 0"
            class="min-w-0 divide-y divide-base-200 border-t border-base-200"
          >
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
                  <span class="shrink-0 text-[11px] text-base-content/45 tabular-nums">
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
                class="shrink-0 text-base-content/30 transition group-active:translate-x-0.5"
                :class="child.chevronClass"
              />
            </button>
          </div>

          <div v-else-if="activeEntry" class="px-4 py-5 text-center">
            <p class="text-xs text-base-content/45">
              {{ activeEntry.description || '当前入口暂无可用内容' }}
            </p>
          </div>
        </template>
      </section>
    </template>

    <BaseModal v-model="subjectPanelOpen" title="科目管理">
      <div>
        <p class="text-xs text-base-content/45">勾选显示，使用箭头调整顺序</p>
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
              :checked="!hiddenSubjectCodes.has(subject.code)"
              :aria-label="`${subject.name}显示状态`"
              @change="toggleSubjectVisibility(subject.code)"
            />
          </label>

          <button
            class="min-w-0 flex-1 text-left"
            :class="[
              activeSubject?.code === subject.code ? 'text-primary' : '',
              hiddenSubjectCodes.has(subject.code) ? 'text-base-content/35' : '',
            ]"
            type="button"
            @click="selectSubject(subject.code)"
          >
            <span class="block truncate text-sm font-medium">{{ subject.name }}</span>
            <span
              v-if="subject.code"
              class="mt-0.5 block truncate text-[11px] text-base-content/40"
            >
              {{ subject.code }}
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

    <PracticeSettingsModal v-model="settingsModalOpen" />

    <StudyPlanModal v-model="planModalOpen" :plan="plan" @updated="handlePlanUpdated" />
  </section>
</template>
