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
import { fetchSubjects } from '@/api/catalog'
import { updateUserPreferences } from '@/api/me'
import { fetchPapers } from '@/api/papers'
import { useAppStore } from '@/stores/app'
import type { PaperListItem, Subject, SubjectSelection } from '@/types/domain'

const router = useRouter()
const app = useAppStore()
const examDate = new Date('2026-10-20T00:00:00+08:00')

type SubjectProjectKey = 'practice' | 'pastExam' | 'mock' | 'ai'

const settingsModalOpen = ref(false)
const subjectPanelOpen = ref(false)
const selectorModalOpen = ref(false)
const papers = ref<PaperListItem[]>([])
const subjects = ref<Subject[]>([])
const allSubjects = ref<Subject[]>([])

const practiceMajorId = ref(app.subjectSelection.majorId)
const practiceSubjectIds = ref<Set<string>>(new Set(app.subjectSelection.subjectIds))
const subjectOrder = ref<string[]>([])
const hiddenSubjectIds = ref<Set<string>>(new Set())
const activeSubjectId = ref('')
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
  category: PaperListItem['paperCategory'] | null
  color: 'primary' | 'secondary' | 'accent' | 'info'
  icon: typeof FileStack
}> = [
  { key: 'practice', label: '专项练习', category: 'practice', color: 'primary', icon: FileStack },
  { key: 'pastExam', label: '历年真题', category: 'pastExam', color: 'secondary', icon: BookOpenCheck },
  { key: 'mock', label: '考前模拟', category: 'mock', color: 'accent', icon: ClipboardList },
  { key: 'ai', label: 'AI强化训练', category: null, color: 'info', icon: Sparkles },
]

function realPapersOfCategory(
  groupPapers: PaperListItem[],
  category: PaperListItem['paperCategory'],
): CategoryPaper[] {
  return groupPapers
    .filter((paper) => paper.paperCategory === category)
    .map((paper) => ({ id: paper.id, name: paper.name, subtitle: '' }))
}

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
  group: { subject: Subject | undefined; papers: PaperListItem[] },
  cat: (typeof subjectCategories)[number],
): CategoryPaper[] {
  const subjectName = group.subject?.name ?? '科目'
  if (cat.category === null) {
    return mockPapersForCategory(subjectName, cat.label)
  }
  const real = realPapersOfCategory(group.papers, cat.category)
  if (real.length > 0) return real
  return mockPapersForCategory(subjectName, cat.label)
}

const selectedMajorName = computed(() => {
  if (!practiceMajorId.value) return ''
  const subject = allSubjects.value.find((s) => s.majorId === practiceMajorId.value)
  return subject?.majorName ?? ''
})

const hasPracticePlan = computed(() => practiceMajorId.value !== '' && practiceSubjectIds.value.size > 0)
const daysUntilExam = computed(() => Math.max(0, differenceInCalendarDays(examDate, new Date())))
const examCountdownText = computed(() => `2026年10月20日 · 还剩 ${daysUntilExam.value} 天`)

const filteredPapers = computed(() => {
  const ids = [...practiceSubjectIds.value]
  if (ids.length === 0) return []
  return papers.value.filter((paper) => ids.includes(paper.subjectId))
})

const papersBySubject = computed(() => {
  const map = new Map<string, { subject: Subject | undefined; papers: PaperListItem[] }>()
  for (const paper of filteredPapers.value) {
    if (!map.has(paper.subjectId)) {
      const subject = subjects.value.find((item) => item.id === paper.subjectId)
      map.set(paper.subjectId, { subject, papers: [] })
    }
    map.get(paper.subjectId)!.papers.push(paper)
  }
  return [...map.values()]
})

const subjectsForDisplay = computed(() =>
  allSubjects.value.filter((s) => practiceSubjectIds.value.has(s.id)),
)

const displayGroups = computed(() => {
  return subjectsForDisplay.value.map((subject) => {
    const group = papersBySubject.value.find((g) => g.subject?.id === subject.id)
    return {
      subject,
      papers: group?.papers ?? [],
    }
  })
})

const orderedSubjectGroups = computed(() => {
  const orderMap = new Map(subjectOrder.value.map((id, index) => [id, index]))
  return [...displayGroups.value].sort((a, b) => {
    const aIndex = orderMap.get(a.subject.id) ?? Number.MAX_SAFE_INTEGER
    const bIndex = orderMap.get(b.subject.id) ?? Number.MAX_SAFE_INTEGER
    return aIndex - bIndex
  })
})

const visibleSubjectGroups = computed(() =>
  orderedSubjectGroups.value.filter((group) => !hiddenSubjectIds.value.has(group.subject.id)),
)

const activeSubjectGroup = computed(() => {
  if (visibleSubjectGroups.value.length === 0) return undefined
  return visibleSubjectGroups.value.find((group) => group.subject.id === activeSubjectId.value)
    ?? visibleSubjectGroups.value[0]
})

const activeProjectRows = computed(() => {
  const group = activeSubjectGroup.value
  if (!group) return []
  return subjectCategories.map((cat) => {
    const papers = categoryPapers(group, cat)
    return {
      ...cat,
      papers,
      count: papers.length,
      preview: papers.slice(0, 2).map((paper) => paper.name).join('、'),
    }
  })
})

function groupPaperCount(group: { subject: Subject | undefined; papers: PaperListItem[] }) {
  return subjectCategories.reduce(
    (sum, cat) => sum + categoryPapers(group, cat).length,
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

function selectSubject(subjectId: string) {
  activeSubjectId.value = subjectId
  expandedProjectKey.value = ''
}

function toggleProjectExpand(projectKey: SubjectProjectKey) {
  expandedProjectKey.value = expandedProjectKey.value === projectKey ? '' : projectKey
}

function syncSubjectOrder() {
  const ids = subjectsForDisplay.value.map((subject) => subject.id)
  subjectOrder.value = [
    ...subjectOrder.value.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !subjectOrder.value.includes(id)),
  ]

  hiddenSubjectIds.value = new Set([...hiddenSubjectIds.value].filter((id) => ids.includes(id)))

  const visibleIds = subjectOrder.value.filter((id) => !hiddenSubjectIds.value.has(id))
  if (!activeSubjectId.value || !visibleIds.includes(activeSubjectId.value)) {
    activeSubjectId.value = visibleIds[0] ?? ''
  }
}

async function loadPapers() {
  const subjectIds = [...practiceSubjectIds.value]
  if (subjectIds.length === 0) {
    papers.value = []
    return
  }
  const allPapers: PaperListItem[] = []
  try {
    for (const subjectId of subjectIds) {
      const result = await fetchPapers({ subjectId, limit: 100 })
      allPapers.push(...result.items)
    }
  } catch {
    papers.value = []
    return
  }
  papers.value = allPapers
}

async function loadAllSubjects() {
  try {
    const loadedSubjects = await fetchSubjects()
    subjects.value = loadedSubjects
    allSubjects.value = loadedSubjects
  } catch {
    subjects.value = []
    allSubjects.value = []
  }
}

function moveSubject(subjectId: string, direction: -1 | 1) {
  const ids = [...subjectOrder.value]
  const index = ids.indexOf(subjectId)
  const nextIndex = index + direction
  if (index < 0 || nextIndex < 0 || nextIndex >= ids.length) return

  const [current] = ids.splice(index, 1)
  if (!current) return
  ids.splice(nextIndex, 0, current)
  subjectOrder.value = ids
}

function toggleSubjectVisibility(subjectId: string) {
  const nextIds = new Set(hiddenSubjectIds.value)
  if (nextIds.has(subjectId)) {
    nextIds.delete(subjectId)
  } else {
    nextIds.add(subjectId)
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

function openSelector() {
  selectorModalOpen.value = true
}

function applyPracticePlan(selection: SubjectSelection) {
  app.setSubjectSelection(selection)
  practiceMajorId.value = selection.majorId
  const newIds = selection.subjectIds
  practiceSubjectIds.value = new Set(newIds)

  // 同步排序：保留已有顺序，追加新增
  subjectOrder.value = [
    ...subjectOrder.value.filter((id) => newIds.includes(id)),
    ...newIds.filter((id) => !subjectOrder.value.includes(id)),
  ]
  // 清理已移除的隐藏状态
  hiddenSubjectIds.value = new Set(
    [...hiddenSubjectIds.value].filter((id) => newIds.includes(id)),
  )
  // 重置活跃科目
  const visibleIds = subjectOrder.value.filter((id) => !hiddenSubjectIds.value.has(id))
  activeSubjectId.value = visibleIds[0] ?? ''

  loadPapers()
  void updateUserPreferences({
    study: {
      majorId: selection.majorId,
      subjectIds: selection.subjectIds,
      subjectOrder: selection.subjectIds,
      hiddenSubjectIds: [...hiddenSubjectIds.value],
    },
  }).catch(() => {})
}

onMounted(() => {
  loadAllSubjects()
  loadPapers()
})

watch(
  () => subjectsForDisplay.value.map((subject) => subject.id).join('|'),
  () => {
    syncSubjectOrder()
  },
  { immediate: true },
)
</script>

<template>
  <section class="flex min-h-[calc(100vh-8rem)] w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
    <section class="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100 p-4">
      <button
        class="flex w-full min-w-0 items-start gap-3 text-left"
        type="button"
        @click="openSelector"
      >
        <span class="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <GraduationCap :size="22" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-lg font-semibold leading-tight text-base-content">
            {{ hasPracticePlan ? selectedMajorName || '当前计划' : '配置刷题计划' }}
          </span>
          <span class="mt-1 block truncate text-sm font-medium text-base-content/50">{{ examCountdownText }}</span>
        </span>
      </button>

      <div class="mt-4 grid grid-cols-2 gap-2">
        <button
          class="flex h-14 min-w-0 items-center gap-2 rounded-xl bg-base-200/70 px-3 text-left transition-colors active:bg-base-300"
          type="button"
          @click="openSelector"
        >
          <SlidersHorizontal :size="18" class="shrink-0 text-primary" />
          <span class="min-w-0">
            <span class="block truncate text-sm font-semibold leading-tight">计划设置</span>
            <span class="mt-0.5 block truncate text-xs font-medium text-base-content/45">专业和科目</span>
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
        <span class="text-sm text-base-content/45">{{ practiceSubjectIds.size }} 个科目</span>
      </div>

      <div class="w-full min-w-0 max-w-full overflow-hidden rounded-2xl border border-base-200 bg-base-100">
        <div
          v-if="hasPracticePlan"
          class="flex items-center gap-2 border-b border-base-200/70 px-4 py-1.5"
        >
          <div class="-ml-1 flex min-w-0 flex-1 gap-5 overflow-x-auto pr-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              v-for="group in visibleSubjectGroups"
              :key="group.subject.id"
              class="flex max-w-[7.25rem] shrink-0 flex-col items-center pt-2 text-sm transition"
              :class="activeSubjectGroup?.subject.id === group.subject.id ? 'font-semibold text-base-content' : 'font-medium text-base-content/45'"
              type="button"
              @click="selectSubject(group.subject.id)"
            >
              <span class="block max-w-full truncate">{{ group.subject.name }}</span>
              <span
                class="mt-1 h-0.5 w-5 rounded-full transition"
                :class="activeSubjectGroup?.subject.id === group.subject.id ? 'bg-primary' : 'bg-transparent'"
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
          v-if="!hasPracticePlan"
          :icon="Target"
          title="暂无刷题科目"
          description="先设置刷题计划。"
          action-label="设置计划"
          @action="openSelector"
        />

        <EmptyState
          v-else-if="orderedSubjectGroups.length === 0"
          :icon="Target"
          title="暂无刷题科目"
          description="选择专业和科目后，会在这里展示本次要刷的科目。"
        />

        <EmptyState
          v-else-if="!activeSubjectGroup"
          :icon="EyeOff"
          title="所有科目已隐藏"
          description="打开右上角科目管理，恢复需要展示的科目。"
        />

        <template v-else-if="activeSubjectGroup">
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
                      {{ row.preview || `${activeSubjectGroup.subject.name}${row.label}` }}
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

    <BaseModal v-model="subjectPanelOpen">
      <div class="-m-1 grid gap-1.5">
        <div
          v-for="(group, index) in orderedSubjectGroups"
          :key="group.subject.id"
          class="flex min-w-0 items-center gap-2 rounded-2xl border border-base-200 bg-base-100 px-2.5 py-2"
        >
          <button
            class="flex min-w-0 flex-1 items-center gap-2.5 text-left"
            type="button"
            @click="selectSubject(group.subject.id)"
          >
            <span class="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
              {{ group.subject.name.slice(0, 1) }}
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex min-w-0 items-center gap-1.5">
                <span class="truncate text-sm font-semibold">{{ group.subject.name }}</span>
                <Check
                  v-if="activeSubjectGroup?.subject.id === group.subject.id"
                  :size="15"
                  class="shrink-0 text-primary"
                />
              </span>
              <span class="mt-0.5 block truncate text-xs text-base-content/45">
                {{ group.subject.majorName }} · {{ groupPaperCount(group) }} 个题包
              </span>
            </span>
          </button>

          <div class="flex shrink-0 items-center gap-0.5">
            <button
              class="btn btn-square btn-ghost btn-xs text-base-content/55"
              type="button"
              aria-label="上移科目"
              :disabled="index === 0"
              @click="moveSubject(group.subject.id, -1)"
            >
              <ArrowUp :size="14" />
            </button>
            <button
              class="btn btn-square btn-ghost btn-xs text-base-content/55"
              type="button"
              aria-label="下移科目"
              :disabled="index === orderedSubjectGroups.length - 1"
              @click="moveSubject(group.subject.id, 1)"
            >
              <ArrowDown :size="14" />
            </button>
            <button
              class="btn btn-square btn-ghost btn-xs"
              :class="hiddenSubjectIds.has(group.subject.id) ? 'text-base-content/35' : 'text-primary'"
              type="button"
              :aria-label="hiddenSubjectIds.has(group.subject.id) ? '显示科目' : '隐藏科目'"
              @click="toggleSubjectVisibility(group.subject.id)"
            >
              <EyeOff v-if="hiddenSubjectIds.has(group.subject.id)" :size="15" />
              <Eye v-else :size="15" />
            </button>
          </div>
        </div>

        <EmptyState
          v-if="orderedSubjectGroups.length === 0"
          :icon="Target"
          title="暂无可管理科目"
          description="先在上方选择本次考试要刷的科目。"
        />
      </div>
    </BaseModal>

    <BaseModal v-model="settingsModalOpen" title="练习设置">
      <PracticeSettingsContent />
    </BaseModal>

    <PracticePlanModal
      v-model="selectorModalOpen"
      :major-id="practiceMajorId"
      :subject-ids="[...practiceSubjectIds]"
      @apply="applyPracticePlan"
    />
  </section>
</template>
