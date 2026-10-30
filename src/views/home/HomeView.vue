<script setup lang="ts">
import {
  AlertCircle,
  BookOpenCheck,
  ChevronRight,
  ClipboardCheck,
  ClipboardList,
  EyeOff,
  GraduationCap,
  ListChecks,
  Settings2,
  Sparkles,
  Target,
} from '@lucide/vue'
import { differenceInCalendarDays, format } from 'date-fns'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import logoPassitai from '@/assets/icons/icon-passitai.svg'
import SubjectManagerPopup from '@/components/home/SubjectManagerPopup.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'
import PracticePlanPopup from '@/components/practice/PracticePlanPopup.vue'
import PracticeSettingsPopup from '@/components/practice/PracticeSettingsPopup.vue'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { BASELINE_CHILD_ICONS } from '@/constants/practice-icons'
import { useAuthStore } from '@/stores/auth'
import { usePracticePlanStore } from '@/stores/practice-plan'
import { usePracticeEntriesStore } from '@/stores/practice-entries'
import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { parseHomeSelection, readBrowseState, writeBrowseState } from '@/utils/browse/state'
import { applyLocalPracticeProgress } from '@/utils/practice/progress'
import type { PracticeEntry, PracticeEntryChild, PracticePlan } from '@/types'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const browseScroll = useBrowseScroll(
  () => auth.session?.user.id ?? '',
  () => 'home',
)
const initialBrowse = readBrowseState(auth.session?.user.id ?? '', 'home')
const initialSelection = parseHomeSelection(route.query, initialBrowse)
const { records } = useLocalPracticeRecords()
const activeSubjectId = ref('')

const settingsPopupOpen = ref(false)
const subjectManagerOpen = ref(false)
const planPopupOpen = ref(false)
// 计划与题集目录来自 plan store:有缓存时挂载即渲染,仅在首次加载(未成功也未失败)时显示整页加载态
const practicePlanStore = usePracticePlanStore()
const practiceEntriesStore = usePracticeEntriesStore()
const plan = computed<PracticePlan | null>(() => practicePlanStore.plan)
const planLoading = computed(
  () => !practicePlanStore.isLoaded && (practicePlanStore.isLoading || !practicePlanStore.error),
)

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
    icon: 'bg-ai/10 text-ai',
    active: 'bg-ai/10 text-ai ring-ai/40',
    progress: 'bg-ai',
    chevron: 'group-active:text-ai',
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
  syncSelectionQuery()
}

function selectEntry(key: string) {
  expandedEntryKey.value = key
  syncSelectionQuery()
}

/** URL 只由用户操作更新;数据加载链路不回写,避免 query ↔ 状态互相触发的同步回路。 */
function syncSelectionQuery() {
  if (route.name !== 'home') return
  const subjectCode = activeSubject.value?.code ?? ''
  const entry = expandedEntryKey.value || 'baseline'
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
  syncSelectionQuery()
}

function startEntryPaper(child: PracticeEntryChild) {
  if (!auth.isAuthenticated || !child.paperId || entriesLoading.value) return
  const returnTo = router.resolve({
    path: route.path,
    query: {
      ...route.query,
      subjectCode: activeSubject.value?.code || undefined,
      entry: expandedEntryKey.value || 'baseline',
    },
  }).fullPath
  router.push({
    name: 'practice',
    params: { paperId: child.paperId },
    query: { subjectName: activeSubject.value?.name ?? '', returnTo },
  })
}

// 计划直接携带科目 ID，题集目录按科目缓存。
let entryLoadSequence = 0

async function loadEntries() {
  const sequence = ++entryLoadSequence
  const userId = auth.session?.user.id
  const token = auth.session?.token
  const isCurrent = () =>
    sequence === entryLoadSequence && token === auth.session?.token && auth.isAuthenticated
  const subject = activeSubject.value
  if (!userId || !auth.isAuthenticated || !subject) {
    entries.value = []
    activeSubjectId.value = ''
    entriesLoading.value = false
    if (auth.isAuthenticated && practicePlanStore.isLoaded && !planLoading.value)
      void browseScroll.restore()
    return
  }
  // 切换科目时保留上一科目的内容与进度,仅在尚无内容时显示占位加载
  entriesLoading.value = true
  try {
    const subjectId = subject.id
    const loadedEntries = await practiceEntriesStore.load(subjectId)
    if (!isCurrent()) return
    activeSubjectId.value = subjectId
    entries.value = loadedEntries ?? []
    const entryMatched = (loadedEntries ?? []).some(
      (entry) => entry.type === expandedEntryKey.value,
    )
    if (entries.value.length > 0 && !entryMatched) {
      expandedEntryKey.value = entries.value[0]?.type ?? ''
    }
  } catch {
    if (!isCurrent()) return
    entries.value = []
  } finally {
    if (isCurrent()) {
      entriesLoading.value = false
      await nextTick()
      if (isCurrent()) {
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
}

onMounted(() => {
  if (auth.isAuthenticated) void practicePlanStore.load()
})

onBeforeUnmount(() => {
  entryLoadSequence++
})

watch([() => route.query.subjectCode, () => route.query.entry], () => {
  const selection = parseHomeSelection(
    route.query,
    readBrowseState(auth.session?.user.id ?? '', 'home'),
  )
  if (selection.subjectCode !== activeSubjectCode.value) {
    activeSubjectCode.value = selection.subjectCode
  }
  if (selection.entry !== expandedEntryKey.value) {
    expandedEntryKey.value = selection.entry
  }
  syncSubjectOrder()
})

// 选中态与科目管理变化只写入本地记忆(按账号),URL 不在此回写。
watch([activeSubjectCode, expandedEntryKey, subjectOrder, hiddenSubjectCodes], () => {
  if (route.name !== 'home') return
  writeBrowseState(auth.session?.user.id ?? '', 'home', {
    subjectCode: activeSubject.value?.code ?? '',
    entry: expandedEntryKey.value || 'baseline',
    subjectOrder: subjectOrder.value,
    hiddenSubjectCodes: [...hiddenSubjectCodes.value],
  })
})

watch(
  () => auth.session?.token,
  () => {
    const userId = auth.session?.user.id
    entryLoadSequence++
    const state = readBrowseState(userId ?? '', 'home')
    const selection = parseHomeSelection({}, state)
    browseScroll.reset()
    // 每次会话变化都重载计划；浏览记忆仍按账号隔离。
    entries.value = []
    entriesLoading.value = false
    activeSubjectId.value = ''
    settingsPopupOpen.value = false
    subjectManagerOpen.value = false
    planPopupOpen.value = false
    subjectOrder.value = state.subjectOrder
    hiddenSubjectCodes.value = new Set(state.hiddenSubjectCodes)
    activeSubjectCode.value = selection.subjectCode
    expandedEntryKey.value = selection.entry
    if (userId && auth.isAuthenticated) void practicePlanStore.load()
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
  () => [plan.value?.majorId, activeSubject.value?.id ?? ''],
  () => {
    void loadEntries()
  },
  { immediate: true },
)
</script>

<template>
  <section
    class="relative flex min-h-[calc(100dvh-8rem)] w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden"
  >
    <header class="flex h-9 shrink-0 items-center">
      <img :src="logoPassitai" alt="Passitai" class="h-8 w-auto" />
    </header>

    <PagePlaceholder v-if="planLoading" role="status" aria-live="polite">
      <span class="loading loading-spinner loading-md text-primary"></span>
      <p class="text-sm font-medium text-base-content/65">正在获取练习计划…</p>
    </PagePlaceholder>

    <PagePlaceholder v-else-if="practicePlanStore.error">
      <EmptyState
        :icon="AlertCircle"
        :title="practicePlanStore.error"
        description="请重试加载刷题计划。"
        action-label="重试"
        @action="practicePlanStore.load()"
      />
    </PagePlaceholder>

    <PagePlaceholder v-else-if="!hasPracticePlan">
      <EmptyState
        :icon="Target"
        title="暂无练习计划"
        description="先选择报考专业与刷题科目。"
        action-label="设置计划"
        @action="planPopupOpen = true"
      />
    </PagePlaceholder>

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
              <p v-if="planMajorCode" class="mt-1.5 text-xs text-base-content/65">
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
              <p class="flex items-center gap-1.5 text-[11px] text-base-content/65">
                <span class="size-1.5 rounded-full bg-info"></span>
                考试时间
              </p>
              <p class="mt-1.5 text-sm font-semibold tabular-nums">{{ nextExamDateText }}</p>
            </div>
            <div class="px-3 py-2.5 text-right">
              <p class="flex items-center justify-end gap-1.5 text-[11px] text-base-content/65">
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
            @click="planPopupOpen = true"
          >
            <ClipboardList :size="15" />
            刷题计划
          </button>
          <button
            class="flex h-10 items-center justify-center gap-1.5 text-xs font-medium text-base-content/60 transition active:bg-base-200/50"
            type="button"
            aria-label="刷题设置"
            @click="settingsPopupOpen = true"
          >
            <Settings2 :size="15" />
            刷题设置
          </button>
        </div>
      </section>

      <div class="flex items-end justify-between gap-3 px-0.5">
        <div class="flex items-baseline gap-2">
          <h2 class="text-[17px] font-semibold leading-tight">刷题科目</h2>
          <span class="text-xs text-base-content/65">{{ planSubjects.length }}个</span>
        </div>
        <button
          class="flex shrink-0 items-center gap-0.5 text-sm font-medium text-primary transition-opacity active:opacity-70"
          type="button"
          aria-label="科目管理"
          @click="subjectManagerOpen = true"
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
            embedded
            @action="subjectManagerOpen = true"
          />
        </div>

        <div
          v-else-if="entriesLoading && entryRows.length === 0"
          class="flex min-h-44 items-center justify-center border-t border-base-200"
        >
          <span class="loading loading-spinner loading-xs text-base-content/40"></span>
        </div>

        <div
          v-else-if="entryRows.length === 0"
          class="flex min-h-44 items-center justify-center border-t border-base-200 px-4 text-center"
        >
          <p class="text-sm text-base-content/65">{{ activeSubject.name }} 暂无可用练习内容</p>
        </div>

        <template v-else>
          <!-- 切换科目加载期间保留上一科目内容:降透明提示更新中,点击由 entriesLoading 拦截 -->
          <div
            class="relative border-t border-base-200 px-4 py-3 transition-opacity"
            :class="entriesLoading ? 'opacity-50' : 'opacity-100'"
          >
            <span
              v-if="entriesLoading"
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

          <!-- 题集列表保持统一最小高度:空态/单条/多条之间切换时卡片不塌陷、不跳动 -->
          <div
            v-if="activeEntryChildren.length > 0"
            class="min-h-44 min-w-0 divide-y divide-base-200 border-t border-base-200"
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
      </section>
    </template>

    <SubjectManagerPopup
      v-model="subjectManagerOpen"
      :subjects="orderedSubjects"
      :active-subject-code="activeSubject?.code"
      :hidden-subject-codes="hiddenSubjectCodes"
      @select="selectSubject"
      @toggle-visibility="toggleSubjectVisibility"
      @move="moveSubject"
    />

    <PracticeSettingsPopup v-model="settingsPopupOpen" />

    <PracticePlanPopup v-model="planPopupOpen" />
  </section>
</template>
