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
import PracticeSettingsContent from '@/components/common/PracticeSettingsContent.vue'
import { fetchMajorOptions, fetchSubjectOptions } from '@/api/catalog'
import { fetchPracticePlan, updatePracticePlan } from '@/api/practice'
import { useAppStore } from '@/stores/app'
import type { OptionItem, PracticePlan } from '@/types/domain'

const router = useRouter()
const app = useAppStore()
const examDate = new Date('2026-10-20T00:00:00+08:00')

type SubjectProjectKey = 'practice' | 'pastExam' | 'mock' | 'ai'

const settingsModalOpen = ref(false)
const subjectPanelOpen = ref(false)
const planModalOpen = ref(false)
const plan = ref<PracticePlan | null>(null)
const planLoading = ref(false)

const majorOptions = ref<OptionItem[]>([])
const subjectOptions = ref<OptionItem[]>([])
const draftMajorId = ref('')
const draftSubjectIds = ref<Set<string>>(new Set())
const planSaving = ref(false)
const subjectOptionsLoading = ref(false)

const subjectOrder = ref<string[]>([])
const hiddenSubjectIds = ref<Set<string>>(new Set())
const activeSubjectCode = ref('')
const expandedProjectKey = ref<SubjectProjectKey | ''>('')

type CategoryPaper = {
  id: string
  name: string
  subtitle: string
  isMock?: boolean
}

const subjectCategories: Array<{
  key: SubjectProjectKey
  label: string
  category: string | null
  color: 'primary' | 'secondary' | 'accent' | 'info'
  icon: typeof FileStack
}> = [
  { key: 'practice', label: '专项练习', category: 'practice', color: 'primary', icon: FileStack },
  { key: 'pastExam', label: '历年真题', category: 'pastExam', color: 'secondary', icon: BookOpenCheck },
  { key: 'mock', label: '考前模拟', category: 'mock', color: 'accent', icon: ClipboardList },
  { key: 'ai', label: 'AI强化训练', category: null, color: 'info', icon: Sparkles },
]

function mockPapersForCategory(subjectName: string, catLabel: string): CategoryPaper[] {
  if (catLabel === '专项练习') {
    return [
      { id: '', name: `${subjectName}-基础概念`, subtitle: '专项', isMock: true },
      { id: '', name: `${subjectName}-核心考点`, subtitle: '专项', isMock: true },
      { id: '', name: `${subjectName}-易错题集`, subtitle: '专项', isMock: true },
    ]
  }
  if (catLabel === '历年真题') {
    return [
      { id: '', name: `${subjectName}2024年真题`, subtitle: '真题', isMock: true },
      { id: '', name: `${subjectName}2023年真题`, subtitle: '真题', isMock: true },
      { id: '', name: `${subjectName}2022年真题`, subtitle: '真题', isMock: true },
    ]
  }
  if (catLabel === '考前模拟') {
    return [
      { id: '', name: `${subjectName}模拟卷一`, subtitle: '模拟', isMock: true },
      { id: '', name: `${subjectName}模拟卷二`, subtitle: '模拟', isMock: true },
    ]
  }
  return [
    { id: '', name: `${subjectName}强化卷202510`, subtitle: 'AI 智能组卷', isMock: true },
    { id: '', name: `${subjectName}强化卷202509`, subtitle: 'AI 智能组卷', isMock: true },
    { id: '', name: `${subjectName}强化卷202508`, subtitle: 'AI 智能组卷', isMock: true },
  ]
}

function categoryPapers(
  subjectName: string,
  cat: (typeof subjectCategories)[number],
): CategoryPaper[] {
  return mockPapersForCategory(subjectName, cat.label)
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
  () => visibleSubjects.value.find((subject) => subject.code === activeSubjectCode.value)
    ?? visibleSubjects.value[0],
)

const activeProjectRows = computed(() => {
  const subject = activeSubject.value
  if (!subject) return []
  return subjectCategories.map((cat) => {
    const papers = categoryPapers(subject.name, cat)
    return {
      ...cat,
      papers,
      count: papers.length,
      preview: papers.slice(0, 2).map((paper) => paper.name).join('、'),
    }
  })
})

function groupPaperCount(subject: { name: string; code: string }) {
  return subjectCategories.reduce(
    (sum, cat) => sum + categoryPapers(subject.name, cat).length,
    0,
  )
}

function categoryToneClasses(color: (typeof subjectCategories)[number]['color']) {
  const map = {
    accent: 'bg-accent/15 text-accent',
    info: 'bg-info/10 text-info',
    primary: 'bg-primary/10 text-primary',
    secondary: 'bg-secondary/10 text-secondary',
  }
  return map[color]
}

function selectSubject(code: string) {
  activeSubjectCode.value = code
  expandedProjectKey.value = ''
}

function toggleProjectExpand(projectKey: SubjectProjectKey) {
  expandedProjectKey.value = expandedProjectKey.value === projectKey ? '' : projectKey
}

function syncSubjectOrder() {
  const codes = planSubjects.value.map((subject) => subject.code)
  subjectOrder.value = [
    ...subjectOrder.value.filter((code) => codes.includes(code)),
    ...codes.filter((code) => !subjectOrder.value.includes(code)),
  ]

  hiddenSubjectIds.value = new Set([...hiddenSubjectIds.value].filter((code) => codes.includes(code)))

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

function startPaper(paper: CategoryPaper) {
  if (paper.id) {
    app.startPracticeSession([paper.id])
    router.push({ name: 'session' })
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

let majorOptionsLoaded = false

async function loadMajorOptions() {
  if (majorOptionsLoaded) return
  try {
    majorOptions.value = await fetchMajorOptions()
    majorOptionsLoaded = true
  } catch {
    majorOptions.value = []
  }
}

async function loadSubjectOptions(majorId: string) {
  if (!majorId) {
    subjectOptions.value = []
    return
  }
  subjectOptionsLoading.value = true
  try {
    subjectOptions.value = await fetchSubjectOptions({ majorId })
  } catch {
    subjectOptions.value = []
  } finally {
    subjectOptionsLoading.value = false
  }
}

async function openPlanModal() {
  planModalOpen.value = true
  draftSubjectIds.value = new Set()
  draftMajorId.value = ''
  subjectOptions.value = []

  await loadMajorOptions()

  const matchedMajor = majorOptions.value.find(
    (major) => major.code === plan.value?.majorCode,
  )
  draftMajorId.value = matchedMajor?.id ?? ''

  if (!draftMajorId.value) return

  await loadSubjectOptions(draftMajorId.value)

  const planCodes = new Set(plan.value?.subjects.map((subject) => subject.code) ?? [])
  draftSubjectIds.value = new Set(
    subjectOptions.value.filter((option) => planCodes.has(option.code)).map((option) => option.id),
  )
}

async function onMajorChange() {
  draftSubjectIds.value = new Set()
  await loadSubjectOptions(draftMajorId.value)
}

function toggleDraftSubject(id: string) {
  const next = new Set(draftSubjectIds.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  draftSubjectIds.value = next
}

async function savePlan() {
  if (!draftMajorId.value || planSaving.value) return
  planSaving.value = true
  try {
    const major = majorOptions.value.find((item) => item.id === draftMajorId.value)
    const updated = await updatePracticePlan({
      majorId: draftMajorId.value,
      majorCode: major?.code,
      subjectIds: [...draftSubjectIds.value],
    })
    plan.value = updated
    planModalOpen.value = false
  } catch {
    // keep modal open on failure
  } finally {
    planSaving.value = false
  }
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
</script>

<template>
  <section class="flex min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
    <section class="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-4">
      <div class="flex w-full min-w-0 items-start gap-3 text-left">
        <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GraduationCap :size="22" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-lg font-semibold leading-tight text-base-content">
            {{ hasPracticePlan ? planMajorName || '当前计划' : '暂无练习计划' }}
          </span>
          <span class="mt-1 block truncate text-sm font-medium text-base-content/50">
            {{ hasPracticePlan && planMajorCode ? `${planMajorCode} · ` : '' }}{{ examCountdownText }}
          </span>
        </span>
      </div>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          class="flex h-14 min-w-0 items-center gap-2 rounded-xl bg-base-200/70 px-3 text-left transition-colors active:bg-base-300"
          type="button"
          @click="openPlanModal"
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
            <span class="mt-0.5 block truncate text-xs font-medium text-base-content/45">答题与解析</span>
          </span>
        </button>
      </div>
    </section>

    <section class="min-w-0 max-w-full overflow-hidden">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">刷题科目</h2>
        <span class="text-sm text-base-content/45">{{ planSubjects.length }} 个科目</span>
      </div>

      <div class="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100">
        <div
          v-if="hasPracticePlan"
          class="flex items-center gap-2 border-b border-base-200/70 px-4 py-1.5"
        >
          <div class="-ml-1 flex min-w-0 flex-1 gap-5 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              v-for="subject in visibleSubjects"
              :key="subject.code"
              class="flex max-w-[7.25rem] shrink-0 flex-col items-center pt-2 text-sm transition"
              :class="activeSubject?.code === subject.code ? 'font-semibold text-base-content' : 'font-medium text-base-content/45'"
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
          <div class="divide-y divide-base-200">
            <div
              v-for="row in activeProjectRows"
              :key="row.key"
              class="min-w-0"
            >
              <button
                class="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_2rem] items-center gap-2 px-4 py-4 text-left transition active:bg-base-200/60"
                type="button"
                @click="toggleProjectExpand(row.key)"
              >
                <span class="flex min-w-0 items-center gap-3">
                  <span
                    class="flex size-10 shrink-0 items-center justify-center rounded-full"
                    :class="categoryToneClasses(row.color)"
                  >
                    <component :is="row.icon" :size="18" />
                  </span>
                  <span class="min-w-0">
                    <span class="block truncate text-base font-semibold leading-tight">{{ row.label }}</span>
                    <span class="mt-1 block truncate text-xs text-base-content/45">
                      {{ row.preview || `${activeSubject.name}${row.label}` }}
                    </span>
                  </span>
                </span>

                <span class="flex items-center justify-end text-base-content/35">
                  <ChevronRight
                    :size="20"
                    class="transition-transform"
                    :class="{ 'rotate-90 text-primary': expandedProjectKey === row.key }"
                  />
                </span>
              </button>

              <div
                v-show="expandedProjectKey === row.key"
                class="border-t border-base-200 bg-base-200/25 px-4 py-2"
              >
                <button
                  v-for="paper in row.papers"
                  :key="paper.id || paper.name"
                  class="group flex w-full min-w-0 items-center gap-3 rounded-xl px-1 py-2.5 text-left transition active:bg-base-200"
                  type="button"
                  @click="startPaper(paper)"
                >
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-base-100 text-primary">
                    <FileStack :size="16" />
                  </span>
                  <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ paper.name }}</span>
                    <span class="mt-0.5 block truncate text-xs" :class="paper.isMock ? 'text-info' : 'text-base-content/40'">
                      {{ paper.subtitle || row.label }}
                    </span>
                  </span>
                  <span class="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary">
                    {{ paper.id ? '开始' : '预览' }}
                    <ArrowRight :size="12" class="transition-transform group-active:translate-x-0.5" />
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
            <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
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
                {{ subject.code }} · {{ groupPaperCount(subject) }} 个题包
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

    <BaseModal v-model="settingsModalOpen" title="练习设置">
      <PracticeSettingsContent />
    </BaseModal>

    <BaseModal v-model="planModalOpen" title="练习计划">
      <div>
        <p class="mb-1.5 text-xs font-medium text-base-content/50">专业</p>
        <select
          class="select select-bordered h-10 w-full rounded-2xl text-sm"
          :value="draftMajorId"
          @change="draftMajorId = ($event.target as HTMLSelectElement).value; onMajorChange()"
        >
          <option value="">请选择专业</option>
          <option v-for="major in majorOptions" :key="major.id" :value="major.id">
            {{ major.name }}
          </option>
        </select>
      </div>

      <div class="mt-4">
        <p class="mb-1.5 text-xs font-medium text-base-content/50">刷题科目</p>
        <div class="max-h-72 overflow-y-auto rounded-2xl bg-base-200/70">
          <div v-if="subjectOptionsLoading" class="flex items-center justify-center p-6">
            <span class="loading loading-spinner loading-sm"></span>
          </div>
          <template v-else>
            <label
              v-for="subject in subjectOptions"
              :key="subject.id"
              class="flex cursor-pointer items-center gap-3 border-b border-base-200 p-3 last:border-b-0 hover:bg-base-200"
              :class="{ 'bg-primary/5': draftSubjectIds.has(subject.id) }"
            >
              <input
                type="checkbox"
                class="checkbox checkbox-sm checkbox-primary"
                :checked="draftSubjectIds.has(subject.id)"
                @change="toggleDraftSubject(subject.id)"
              />
              <span class="flex-1 text-sm">{{ subject.name }}</span>
              <span class="text-xs text-base-content/40">{{ subject.code }}</span>
              <Check v-if="draftSubjectIds.has(subject.id)" :size="16" class="text-primary" />
            </label>
            <div v-if="!draftMajorId" class="p-4 text-center text-sm text-base-content/50">
              请先选择专业
            </div>
            <div v-else-if="subjectOptions.length === 0" class="p-4 text-center text-sm text-base-content/50">
              该专业暂无科目
            </div>
          </template>
        </div>
      </div>

      <template #footer>
        <button
          class="btn btn-ghost btn-sm flex-1 rounded-full"
          type="button"
          @click="planModalOpen = false"
        >
          取消
        </button>
        <button
          class="btn btn-primary btn-sm flex-1 rounded-full"
          type="button"
          :disabled="planSaving || !draftMajorId"
          @click="savePlan"
        >
          <span v-if="planSaving" class="loading loading-spinner loading-xs"></span>
          保存
        </button>
      </template>
    </BaseModal>
  </section>
</template>
