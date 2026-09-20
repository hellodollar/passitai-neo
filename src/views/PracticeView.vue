<script setup lang="ts">
import {
  ArrowRight,
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  Check,
  ChevronRight,
  ClipboardList,
  Eye,
  EyeOff,
  FileStack,
  GraduationCap,
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

function toggleEntryExpand(key: string) {
  expandedEntryKey.value = expandedEntryKey.value === key ? '' : key
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
  entriesLoading.value = true
  try {
    entries.value = await fetchPracticeEntries(subject.code)
  } catch {
    entries.value = []
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
    <section
      class="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-4"
    >
      <div class="flex w-full min-w-0 items-start gap-3 text-left">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <GraduationCap :size="22" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-lg font-semibold leading-tight text-base-content">
            {{ hasPracticePlan ? planMajorName || '当前计划' : '暂无练习计划' }}
          </span>
          <span class="mt-1 block truncate text-sm font-medium text-base-content/50">
            {{ hasPracticePlan && planMajorCode ? `${planMajorCode} · ` : ''
            }}{{ examCountdownText }}
          </span>
        </span>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          class="flex h-14 min-w-0 items-center gap-2 rounded-xl bg-base-200/70 px-3 text-left transition-colors active:bg-base-300"
          type="button"
          @click="planModalOpen = true"
        >
          <SlidersHorizontal :size="18" class="shrink-0 text-primary" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold leading-tight">练习计划</span>
            <span class="mt-0.5 block truncate text-xs font-medium text-base-content/45">
              {{ planSubjects.length }} 个科目
            </span>
          </span>
        </button>

        <button
          class="flex h-14 min-w-0 items-center gap-2 rounded-xl bg-base-200/70 px-3 text-left transition-colors active:bg-base-300"
          type="button"
          @click="settingsModalOpen = true"
        >
          <Settings2 :size="18" class="shrink-0 text-primary" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold leading-tight">练习设置</span>
            <span class="mt-0.5 block truncate text-xs font-medium text-base-content/45"
              >答题与解析</span
            >
          </span>
        </button>
      </div>
    </section>

    <section class="min-w-0 max-w-full overflow-hidden">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">刷题科目</h2>
        <span class="text-sm text-base-content/45">{{ planSubjects.length }} 个科目</span>
      </div>

      <div
        class="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100"
      >
        <div
          v-if="hasPracticePlan"
          class="flex items-center gap-2 border-b border-base-200/70 px-4 py-1.5"
        >
          <div
            class="-ml-1 flex min-w-0 flex-1 gap-5 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <button
              v-for="subject in visibleSubjects"
              :key="subject.code"
              class="flex max-w-[7.25rem] shrink-0 flex-col items-center pt-2 text-sm transition"
              :class="
                activeSubject?.code === subject.code
                  ? 'font-semibold text-base-content'
                  : 'font-medium text-base-content/45'
              "
              type="button"
              @click="selectSubject(subject.code)"
            >
              <span class="block max-w-full truncate">{{ subject.name }}</span>
              <span
                class="mt-1 h-0.5 w-5 rounded-full transition"
                :class="activeSubject?.code === subject.code ? 'bg-primary' : 'bg-transparent'"
              ></span>
            </button>
          </div>
          <button
            class="btn btn-square btn-ghost btn-sm shrink-0 text-base-content/65"
            type="button"
            aria-label="科目管理"
            @click="subjectPanelOpen = true"
          >
            <SlidersHorizontal :size="21" />
          </button>
        </div>

        <EmptyState
          v-if="planLoading"
          :icon="Target"
          title="加载中"
          description="正在获取练习计划…"
        />

        <EmptyState
          v-else-if="!hasPracticePlan"
          :icon="Target"
          title="暂无练习计划"
          description="还没有配置练习计划。"
          action-label="重新加载"
          @action="loadPlan"
        />

        <EmptyState
          v-else-if="!activeSubject"
          :icon="EyeOff"
          title="所有科目已隐藏"
          description="打开右上角科目管理，恢复需要展示的科目。"
        />

        <template v-else-if="activeSubject">
          <div v-if="entriesLoading" class="flex items-center justify-center p-6">
            <span class="loading loading-spinner loading-sm"></span>
          </div>

          <EmptyState
            v-else-if="entryRows.length === 0"
            :icon="Target"
            title="暂无练习入口"
            :description="`${activeSubject.name} 暂无可用练习入口。`"
          />

          <div v-else class="divide-y divide-base-200">
            <div v-for="entry in entryRows" :key="entry.type" class="min-w-0">
              <button
                class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 px-4 py-4 text-left transition active:bg-base-200/60"
                type="button"
                @click="toggleEntryExpand(entry.type)"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-full"
                    :class="entryToneClasses(entry.tone)"
                  >
                    <component :is="entry.icon" :size="18" />
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-base font-semibold leading-tight">{{
                      entry.name
                    }}</span>
                    <span class="mt-1 block truncate text-xs text-base-content/45">
                      {{ entry.description || entry.name }}
                    </span>
                  </span>
                </span>

                <span class="flex items-center justify-end text-base-content/35">
                  <ChevronRight
                    v-if="entry.children && entry.children.length > 0"
                    :size="20"
                    class="transition-transform"
                    :class="{ 'rotate-90 text-primary': expandedEntryKey === entry.type }"
                  />
                  <span
                    v-else
                    class="rounded-full bg-info/10 px-2 py-0.5 text-[11px] font-semibold text-info"
                  >
                    AI
                  </span>
                </span>
              </button>

              <div
                v-if="entry.children && entry.children.length > 0"
                v-show="expandedEntryKey === entry.type"
                class="border-t border-base-200 bg-base-200/25 px-4 py-2"
              >
                <button
                  v-for="child in entry.children"
                  :key="child.paperId"
                  class="group flex w-full min-w-0 items-center gap-3 rounded-xl px-1 py-2.5 text-left transition active:bg-base-200"
                  type="button"
                  @click="startEntryPaper(child)"
                >
                  <span
                    class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-base-100 text-primary"
                  >
                    <FileStack :size="16" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ child.name }}</span>
                    <span class="mt-0.5 block truncate text-xs text-base-content/40">
                      {{ child.answeredCount }}/{{ child.questionCount }} 题
                    </span>
                  </span>
                  <span
                    class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary"
                  >
                    开始
                    <ArrowRight
                      :size="12"
                      class="transition-transform group-active:translate-x-0.5"
                    />
                  </span>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>
    </section>

    <BaseModal v-model="subjectPanelOpen" title="科目管理">
      <div class="-m-1 grid gap-1.5">
        <div
          v-for="(subject, index) in orderedSubjects"
          :key="subject.code"
          class="flex min-w-0 items-center gap-2 rounded-2xl border border-base-200 bg-base-100 px-2.5 py-2"
        >
          <button
            class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            type="button"
            @click="selectSubject(subject.code)"
          >
            <span
              class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary"
            >
              {{ subject.name.slice(0, 1) }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="truncate text-sm font-semibold">{{ subject.name }}</span>
                <Check
                  v-if="activeSubject?.code === subject.code"
                  :size="15"
                  class="shrink-0 text-primary"
                />
              </span>
              <span class="mt-0.5 block truncate text-xs text-base-content/45">
                {{ subject.code }}
              </span>
            </span>
          </button>

          <div class="flex shrink-0 items-center gap-0.5">
            <button
              class="btn btn-square btn-ghost btn-xs text-base-content/55"
              type="button"
              aria-label="上移科目"
              :disabled="index === 0"
              @click="moveSubject(subject.code, -1)"
            >
              <ArrowUp :size="14" />
            </button>
            <button
              class="btn btn-square btn-ghost btn-xs text-base-content/55"
              type="button"
              aria-label="下移科目"
              :disabled="index === orderedSubjects.length - 1"
              @click="moveSubject(subject.code, 1)"
            >
              <ArrowDown :size="14" />
            </button>
            <button
              class="btn btn-square btn-ghost btn-xs"
              :class="hiddenSubjectIds.has(subject.code) ? 'text-base-content/35' : 'text-primary'"
              type="button"
              :aria-label="hiddenSubjectIds.has(subject.code) ? '显示科目' : '隐藏科目'"
              @click="toggleSubjectVisibility(subject.code)"
            >
              <EyeOff v-if="hiddenSubjectIds.has(subject.code)" :size="15" />
              <Eye v-else :size="15" />
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
