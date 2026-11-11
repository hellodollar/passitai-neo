<script setup lang="ts">
import { AlertCircle, Bell, ChevronRight, EyeOff, Target } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EmptyState from '@/components/common/EmptyState.vue'
import LogoPassitai from '@/components/common/LogoPassitai.vue'
import PageContainer from '@/components/common/PageContainer.vue'
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'
import HomePlanCard from '@/components/home/HomePlanCard.vue'
import NotificationStrip from '@/components/home/NotificationStrip.vue'
import HomePracticeEntries from '@/components/home/HomePracticeEntries.vue'
import SubjectManagerPopup from '@/components/home/SubjectManagerPopup.vue'
import PracticePlanPopup from '@/components/practice/PracticePlanPopup.vue'
import PracticeSettingsPopup from '@/components/practice/PracticeSettingsPopup.vue'
import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { useLocalPracticeRecords } from '@/composables/useLocalPracticeRecords'
import { useAuthStore } from '@/stores/auth'
import { usePracticeEntriesStore } from '@/stores/practice-entries'
import { usePracticePlanStore } from '@/stores/practice-plan'
import type { PracticeEntry, PracticeEntryChild, PracticePlan } from '@/types'
import { parseHomeSelection, readBrowseState, writeBrowseState } from '@/utils/browse/state'
import { applyLocalPracticeProgress } from '@/utils/practice/progress'

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

const planSubjects = computed(() => plan.value?.subjects ?? [])

const hasPracticePlan = computed(() => planSubjects.value.length > 0)

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

function selectSubject(code: string) {
  activeSubjectCode.value = code
  expandedEntryKey.value = 'specialTraining'
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
  const entry = expandedEntryKey.value || 'specialTraining'
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
      entry: expandedEntryKey.value || 'specialTraining',
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
    if (auth.isAuthenticated && practicePlanStore.isLoaded && !planLoading.value) {
      void browseScroll.restore()
    }
    return
  }
  // 切换科目时保留上一科目的内容与进度,仅在尚无内容时显示占位加载
  entriesLoading.value = true
  try {
    const subjectId = subject.id
    const loadedEntries = await practiceEntriesStore.load(subjectId, plan.value?.provinceCode)
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
    entry: expandedEntryKey.value || 'specialTraining',
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
  () => [plan.value?.provinceCode, plan.value?.majorId, activeSubject.value?.id ?? ''],
  () => {
    void loadEntries()
  },
  { immediate: true },
)
</script>

<template>
  <PageContainer>
    <section class="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <h1 class="sr-only">练习首页</h1>
      <header class="flex h-9 shrink-0 items-center">
        <LogoPassitai role="img" aria-label="Passitai" class="h-8 w-auto text-base-content" />
        <button
          class="relative ml-auto flex size-9 items-center justify-center rounded-full border border-base-200 bg-base-100 text-base-content transition-colors active:bg-base-200/60"
          type="button"
          aria-label="消息中心,3 条未读"
          @click="router.push({ name: 'notifications' })"
        >
          <Bell :size="18" />
          <!-- 占位未读数:接口落地后由未读数 composable 提供 -->
          <span
            class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-base-100 bg-error px-1 text-[10px] font-semibold text-error-content"
            >3</span
          >
        </button>
      </header>

      <!-- 通知公告条:静态占位,无未读时由数据驱动隐藏 -->
      <NotificationStrip />

      <PagePlaceholder v-if="planLoading" role="status" aria-live="polite">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <p class="text-sm font-medium text-base-content/65">正在获取练习计划…</p>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="practicePlanStore.error">
        <EmptyState
          :icon="AlertCircle"
          tone="error"
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
        <HomePlanCard
          v-if="plan"
          :plan="plan"
          @edit-plan="planPopupOpen = true"
          @edit-settings="settingsPopupOpen = true"
        />

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

          <HomePracticeEntries
            v-else
            :entries="localEntries"
            :selected-entry="expandedEntryKey"
            :loading="entriesLoading"
            :subject-name="activeSubject.name"
            @select-entry="selectEntry"
            @start-paper="startEntryPaper"
          />
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
  </PageContainer>
</template>
