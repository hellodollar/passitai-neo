<script setup lang="ts">
import { AlertCircle, Bell, ChevronRight, EyeOff, Target } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { PAPER_PAGE_SIZE } from '@/api/papers'
import EmptyState from '@/components/common/EmptyState.vue'
import LogoPassitai from '@/components/common/LogoPassitai.vue'
import PageContainer from '@/components/common/PageContainer.vue'
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'
import HomePapers from '@/components/home/HomePapers.vue'
import HomeScopeCard from '@/components/home/HomeScopeCard.vue'
import NotificationStrip from '@/components/home/NotificationStrip.vue'
import SubjectManagerPopup from '@/components/home/SubjectManagerPopup.vue'
import PracticeScopePopup from '@/components/practice/PracticeScopePopup.vue'
import PracticeSettingsPopup from '@/components/practice/PracticeSettingsPopup.vue'
import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import { usePapersStore } from '@/stores/papers'
import { usePracticeScopeStore } from '@/stores/practice-scope'
import type { PracticeScope } from '@/types'
import type { Paper, PaperType } from '@/types/paper'
import { parseHomeSelection, readBrowseState, writeBrowseState } from '@/utils/browse/state'

const router = useRouter()
const route = useRoute()
const notifications = useNotificationsStore()
const auth = useAuthStore()
const browseScroll = useBrowseScroll(
  () => auth.session?.user.id ?? '',
  () => 'home',
)
const initialBrowse = readBrowseState(auth.session?.user.id ?? '', 'home')
const initialSelection = parseHomeSelection(route.query, initialBrowse)

const settingsPopupOpen = ref(false)
const subjectManagerOpen = ref(false)
const scopePopupOpen = ref(false)
// 备考范围从共享状态读取，首次加载时显示占位。
const practiceScopeStore = usePracticeScopeStore()
const papersStore = usePapersStore()
const scope = computed<PracticeScope | null>(() => practiceScopeStore.scope)
const scopeLoading = computed(
  () => !practiceScopeStore.isLoaded && (practiceScopeStore.isLoading || !practiceScopeStore.error),
)

const subjectOrder = ref<string[]>(initialBrowse.subjectOrder)
const hiddenSubjectCodes = ref<Set<string>>(new Set(initialBrowse.hiddenSubjectCodes))
const activeSubjectCode = ref(initialSelection.subjectCode)
const paperType = ref(initialSelection.paperType)
const paperPage = ref(initialSelection.paperPage)
const papers = ref<Paper[]>([])
const papersLoading = ref(false)
const papersError = ref('')
const totalPapers = ref(0)
const totalPages = computed(() => Math.max(1, Math.ceil(totalPapers.value / PAPER_PAGE_SIZE)))

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

const scopeSubjects = computed(() => scope.value?.subjects ?? [])

const orderedSubjects = computed(() => {
  const orderMap = new Map(subjectOrder.value.map((code, index) => [code, index]))
  return [...scopeSubjects.value].sort((a, b) => {
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

function selectSubject(code: string) {
  activeSubjectCode.value = code
  paperPage.value = 1
  syncSelectionQuery()
}

function selectPaperType(type: PaperType | '') {
  paperType.value = type
  paperPage.value = 1
  syncSelectionQuery()
}

function selectPaperPage(page: number) {
  paperPage.value = page
  syncSelectionQuery()
}

function selectionQuery() {
  return {
    subjectCode: activeSubject.value?.code ?? '',
    paperType: paperType.value,
    paperPage: String(paperPage.value),
  }
}

function syncSelectionQuery() {
  if (route.name !== 'home') return
  const query = selectionQuery()
  if (Object.entries(query).some(([key, value]) => route.query[key] !== value)) {
    void router.replace({ query: { ...route.query, ...query } })
  }
}

function syncSubjectOrder() {
  if (!scope.value) return
  const codes = scopeSubjects.value.map((subject) => subject.code)
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
    paperPage.value = 1
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

function openPaper(paper: Paper) {
  if (
    !auth.isAuthenticated ||
    papersLoading.value ||
    paper.subjectCode !== activeSubject.value?.code
  ) {
    return
  }
  const returnTo = router.resolve({
    name: 'home',
    query: { ...route.query, ...selectionQuery() },
  }).fullPath
  void router.push({ name: 'paper', params: { paperId: paper.id }, query: { returnTo } })
}

let paperLoadSequence = 0
async function loadPapers() {
  const sequence = ++paperLoadSequence
  const token = auth.session?.token
  const isCurrent = () => sequence === paperLoadSequence && token === auth.session?.token
  const subjectCode = activeSubject.value?.code
  const page = paperPage.value
  papers.value = []
  totalPapers.value = 0
  papersError.value = ''
  papersLoading.value = Boolean(token && subjectCode)
  if (!token || !subjectCode) return
  try {
    const result = await papersStore.load(subjectCode, page, paperType.value || undefined)
    if (!isCurrent() || !result) return
    const lastPage = Math.max(1, Math.ceil(result.total / PAPER_PAGE_SIZE))
    if (page > lastPage) {
      selectPaperPage(lastPage)
      return
    }
    papers.value = result.items
    totalPapers.value = result.total
  } catch (error) {
    if (isCurrent()) papersError.value = error instanceof Error ? error.message : '题集加载失败'
  } finally {
    if (isCurrent()) {
      papersLoading.value = false
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
        if (!papersError.value && page === paperPage.value) void browseScroll.restore()
      }
    }
  }
}

onMounted(() => {
  if (auth.isAuthenticated) void practiceScopeStore.load()
})

onBeforeUnmount(() => {
  paperLoadSequence++
})

watch(
  [() => route.query.subjectCode, () => route.query.paperType, () => route.query.paperPage],
  () => {
    if (route.name !== 'home') return
    const selection = parseHomeSelection(
      route.query,
      readBrowseState(auth.session?.user.id ?? '', 'home'),
    )
    activeSubjectCode.value = selection.subjectCode
    paperType.value = selection.paperType
    paperPage.value = selection.paperPage
    syncSubjectOrder()
  },
)

watch([activeSubjectCode, paperType, paperPage, subjectOrder, hiddenSubjectCodes], () => {
  if (route.name !== 'home') return
  writeBrowseState(auth.session?.user.id ?? '', 'home', {
    subjectCode: activeSubject.value?.code ?? '',
    paperType: paperType.value,
    paperPage: paperPage.value,
    subjectOrder: subjectOrder.value,
    hiddenSubjectCodes: [...hiddenSubjectCodes.value],
  })
})

watch(
  () => auth.session?.token,
  () => {
    const userId = auth.session?.user.id
    paperLoadSequence++
    const state = readBrowseState(userId ?? '', 'home')
    const selection = parseHomeSelection({}, state)
    browseScroll.reset()
    papers.value = []
    papersLoading.value = false
    papersError.value = ''
    totalPapers.value = 0
    settingsPopupOpen.value = false
    subjectManagerOpen.value = false
    scopePopupOpen.value = false
    subjectOrder.value = state.subjectOrder
    hiddenSubjectCodes.value = new Set(state.hiddenSubjectCodes)
    activeSubjectCode.value = selection.subjectCode
    paperType.value = selection.paperType
    paperPage.value = selection.paperPage
    if (userId && auth.isAuthenticated) void practiceScopeStore.load()
  },
)

watch(
  () => scopeSubjects.value.map((subject) => subject.code).join('|'),
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
  [() => auth.session?.token, () => activeSubject.value?.code, paperType, paperPage],
  () => {
    void loadPapers()
  },
  { immediate: true },
)
</script>

<template>
  <PageContainer>
    <section class="flex w-full min-w-0 max-w-full flex-col gap-4 overflow-x-hidden">
      <h1 class="sr-only">练习首页</h1>
      <header class="relative z-10 flex h-9 shrink-0 items-center">
        <LogoPassitai role="img" aria-label="Passitai" class="h-8 w-auto text-base-content" />
        <button
          class="relative ml-auto flex size-9 items-center justify-center rounded-full border border-base-200 bg-base-100 text-base-content transition-colors active:bg-base-200/60"
          type="button"
          :aria-label="
            notifications.unreadCount ? `消息中心，${notifications.unreadCount} 条未读` : '消息中心'
          "
          @click="router.push({ name: 'notifications' })"
        >
          <Bell :size="18" />
          <span
            v-if="notifications.unreadCount > 0"
            class="absolute right-0 top-0 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-base-100 bg-error px-1 text-[10px] font-semibold text-error-content"
            >{{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}</span
          >
        </button>
      </header>

      <NotificationStrip class="relative z-10" />

      <PagePlaceholder v-if="scopeLoading" role="status" aria-live="polite">
        <span class="loading loading-spinner loading-md text-primary"></span>
        <p class="text-sm font-medium text-base-content/65">正在获取备考范围…</p>
      </PagePlaceholder>

      <PagePlaceholder v-else-if="practiceScopeStore.error">
        <EmptyState
          :icon="AlertCircle"
          tone="error"
          :title="practiceScopeStore.error"
          description="请重试加载备考范围。"
          action-label="重试"
          @action="practiceScopeStore.load()"
        />
      </PagePlaceholder>

      <PagePlaceholder v-else-if="!scope">
        <EmptyState
          :icon="Target"
          title="暂无备考范围"
          description="先选择报考专业与刷题科目。"
          action-label="设置备考范围"
          @action="scopePopupOpen = true"
        />
      </PagePlaceholder>

      <template v-else>
        <HomeScopeCard
          v-if="scope"
          :scope="scope"
          @edit-scope="scopePopupOpen = true"
          @edit-settings="settingsPopupOpen = true"
        />

        <div class="flex items-end justify-between gap-3 px-0.5">
          <div class="flex items-baseline gap-2">
            <h2 class="text-[17px] font-semibold leading-tight">刷题科目</h2>
            <span class="text-xs text-base-content/65">{{ scopeSubjects.length }}个</span>
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

          <EmptyState
            v-if="!scopeSubjects.length"
            :icon="Target"
            title="还没有选择科目"
            action-label="选择科目"
            embedded
            @action="scopePopupOpen = true"
          />

          <div v-else-if="!activeSubject">
            <EmptyState
              :icon="EyeOff"
              title="所有科目已隐藏"
              description="在科目管理中恢复需要展示的科目。"
              action-label="管理科目"
              embedded
              @action="subjectManagerOpen = true"
            />
          </div>

          <HomePapers
            v-else
            :papers="papers"
            :type="paperType"
            :page="paperPage"
            :total-pages="totalPages"
            :loading="papersLoading"
            :error="papersError"
            @select-type="selectPaperType"
            @select-page="selectPaperPage"
            @open-paper="openPaper"
            @retry="loadPapers"
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

      <PracticeScopePopup v-model="scopePopupOpen" />
    </section>
  </PageContainer>
</template>
