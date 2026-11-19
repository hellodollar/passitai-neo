<script setup lang="ts">
import { Bell, ChevronRight, CircleAlert, EyeOff, GraduationCap } from '@lucide/vue'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EmptyState from '@/components/common/EmptyState.vue'
import LogoPassitai from '@/components/common/LogoPassitai.vue'
import PageContainer from '@/components/common/PageContainer.vue'
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'
import ExamPlanCard from '@/components/exam-plan/ExamPlanCard.vue'
import ExamPlanPopup from '@/components/exam-plan/ExamPlanPopup.vue'
import ExamPlanSubjectsPopup from '@/components/exam-plan/ExamPlanSubjectsPopup.vue'
import HomePracticeResources from '@/components/home/HomePracticeResources.vue'
import NotificationStrip from '@/components/home/NotificationStrip.vue'
import PracticeSettingsPopup from '@/components/practice/PracticeSettingsPopup.vue'
import { useBrowseScroll } from '@/composables/useBrowseScroll'
import { useAuthStore } from '@/stores/auth'
import { useExamPlanStore } from '@/stores/exam-plan'
import { useNotificationsStore } from '@/stores/notifications'
import type { ExamPlan, Paper } from '@/types'
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
const examPlanPopupOpen = ref(false)
// 考试计划从共享状态读取，首次加载时显示占位。
const examPlanStore = useExamPlanStore()
const examPlan = computed<ExamPlan | null>(() => examPlanStore.plan)
const examPlanLoading = computed(
  () => !examPlanStore.isLoaded && (examPlanStore.isLoading || !examPlanStore.error),
)

const subjectOrder = ref<string[]>(initialBrowse.subjectOrder)
const hiddenSubjectCodes = ref<Set<string>>(new Set(initialBrowse.hiddenSubjectCodes))
const activeSubjectCode = ref(initialSelection.subjectCode)

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

const examPlanSubjects = computed(() => examPlan.value?.subjects ?? [])

const orderedSubjects = computed(() => {
  const orderMap = new Map(subjectOrder.value.map((code, index) => [code, index]))
  return [...examPlanSubjects.value].sort((a, b) => {
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
  syncSelectionQuery()
}

function selectionQuery() {
  return {
    subjectCode: activeSubject.value?.code ?? '',
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
  if (!examPlan.value) return
  const codes = examPlanSubjects.value.map((subject) => subject.code)
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

function openPaper(paper: Paper) {
  if (!auth.isAuthenticated || paper.subjectCode !== activeSubject.value?.code) return
  const returnTo = router.resolve({
    name: 'home',
    query: { ...route.query, ...selectionQuery() },
  }).fullPath
  void router.push({ name: 'practice', params: { paperId: paper.id }, query: { returnTo } })
}

onMounted(() => {
  if (auth.isAuthenticated) void examPlanStore.load()
})

watch(
  () => route.query.subjectCode,
  () => {
    if (route.name !== 'home') return
    const selection = parseHomeSelection(
      route.query,
      readBrowseState(auth.session?.user.id ?? '', 'home'),
    )
    activeSubjectCode.value = selection.subjectCode
    syncSubjectOrder()
  },
)

watch([activeSubjectCode, subjectOrder, hiddenSubjectCodes], () => {
  if (route.name !== 'home') return
  writeBrowseState(auth.session?.user.id ?? '', 'home', {
    subjectCode: activeSubject.value?.code ?? '',
    subjectOrder: subjectOrder.value,
    hiddenSubjectCodes: [...hiddenSubjectCodes.value],
  })
})

watch(
  () => auth.session?.token,
  () => {
    const userId = auth.session?.user.id
    const state = readBrowseState(userId ?? '', 'home')
    const selection = parseHomeSelection({}, state)
    browseScroll.reset()
    settingsPopupOpen.value = false
    subjectManagerOpen.value = false
    examPlanPopupOpen.value = false
    subjectOrder.value = state.subjectOrder
    hiddenSubjectCodes.value = new Set(state.hiddenSubjectCodes)
    activeSubjectCode.value = selection.subjectCode
    if (userId && auth.isAuthenticated) void examPlanStore.load()
  },
)

watch(
  () => examPlanSubjects.value.map((subject) => subject.code).join('|'),
  () => {
    syncSubjectOrder()
  },
  { immediate: true },
)

watch(
  [
    () => visibleSubjects.value.map((subject) => subject.code).join('|'),
    () => activeSubject.value?.code,
  ],
  async () => {
    await nextTick()
    const row = chipsRow.value
    const selected = row?.querySelector<HTMLElement>('[aria-pressed="true"]')
    if (row && selected) row.scrollLeft = Math.max(0, selected.offsetLeft - row.offsetLeft - 16)
    updateChipsScrollHint()
  },
  { immediate: true },
)
</script>

<template>
  <div class="min-h-dvh overflow-x-hidden bg-base-200/80 dark:bg-base-100">
    <PageContainer>
      <section class="flex w-full min-w-0 max-w-full flex-col gap-3.5">
        <h1 class="sr-only">练习首页</h1>
        <header class="relative z-10 flex min-h-9 shrink-0 items-center">
          <LogoPassitai role="img" aria-label="Passitai" class="h-7 w-auto text-base-content" />
          <button
            class="relative ml-auto flex size-9 items-center justify-center rounded-full bg-base-100 text-base-content transition-colors active:bg-base-200/70 dark:bg-base-200 dark:active:bg-base-300/60"
            type="button"
            :aria-label="
              notifications.unreadCount
                ? `消息中心，${notifications.unreadCount} 条未读`
                : '消息中心'
            "
            @click="router.push({ name: 'notifications' })"
          >
            <Bell :size="17" />
            <span
              v-if="notifications.unreadCount > 0"
              class="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-base-100 bg-error px-1 text-[10px] font-semibold text-error-content dark:border-base-200"
              >{{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}</span
            >
          </button>
        </header>

        <NotificationStrip class="relative z-10" />

        <PagePlaceholder v-if="examPlanLoading" role="status" aria-live="polite">
          <span class="loading loading-spinner loading-md text-primary"></span>
          <p class="text-sm font-medium text-base-content/65">正在获取考试计划…</p>
        </PagePlaceholder>

        <PagePlaceholder v-else-if="examPlanStore.error">
          <div class="w-full rounded-2xl bg-base-100 dark:bg-base-200">
            <EmptyState
              :icon="CircleAlert"
              tone="error"
              :title="examPlanStore.error"
              description="请重试加载考试计划。"
              action-label="重试"
              embedded
              @action="examPlanStore.load()"
            />
          </div>
        </PagePlaceholder>

        <PagePlaceholder v-else-if="!examPlan">
          <div class="w-full rounded-2xl bg-base-100 dark:bg-base-200">
            <EmptyState
              :icon="GraduationCap"
              title="暂无考试计划"
              description="先选择报考专业与刷题科目。"
              action-label="设置考试计划"
              embedded
              @action="examPlanPopupOpen = true"
            />
          </div>
        </PagePlaceholder>

        <template v-else>
          <ExamPlanCard
            v-if="examPlan"
            :plan="examPlan"
            @edit-exam-plan="examPlanPopupOpen = true"
            @edit-settings="settingsPopupOpen = true"
          />

          <div class="space-y-2.5">
            <div class="flex items-center justify-between gap-3 px-0.5">
              <div class="flex items-baseline gap-1.5">
                <h2 class="text-[15px] font-bold leading-tight tracking-tight">刷题科目</h2>
                <span class="text-xs font-medium tabular-nums text-base-content/45">
                  {{ examPlanSubjects.length }} 科
                </span>
              </div>
              <button
                class="flex shrink-0 items-center gap-0.5 rounded-full bg-base-100 px-2.5 py-1 text-xs font-medium text-primary transition-colors active:bg-base-200/70 dark:bg-base-200 dark:active:bg-base-300/60"
                type="button"
                aria-label="科目管理"
                @click="subjectManagerOpen = true"
              >
                管理
                <ChevronRight :size="13" class="-mr-0.5" />
              </button>
            </div>

            <div v-if="visibleSubjects.length > 0" class="relative -mx-4">
              <div
                ref="chipsRow"
                class="no-scrollbar flex gap-2 overflow-x-auto px-4 py-0.5"
                @scroll.passive="updateChipsScrollHint"
              >
                <button
                  v-for="subject in visibleSubjects"
                  :key="subject.code"
                  class="max-w-[9.5rem] shrink-0 truncate rounded-full px-3.5 py-1.5 text-[13px] transition-colors"
                  :class="
                    activeSubject?.code === subject.code
                      ? 'bg-primary font-semibold text-primary-content'
                      : 'bg-base-100 font-medium text-base-content/70 active:bg-base-100/80 dark:bg-base-200'
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
                class="pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-base-200/95 via-base-200/70 to-transparent dark:from-base-100 dark:via-base-100/75"
                aria-hidden="true"
              ></span>
            </div>

            <div
              v-if="!examPlanSubjects.length"
              class="overflow-hidden rounded-2xl bg-base-100 dark:bg-base-200"
            >
              <EmptyState
                :icon="GraduationCap"
                title="还没有选择科目"
                action-label="选择科目"
                embedded
                @action="examPlanPopupOpen = true"
              />
            </div>

            <div
              v-else-if="!activeSubject"
              class="overflow-hidden rounded-2xl bg-base-100 dark:bg-base-200"
            >
              <EmptyState
                :icon="EyeOff"
                title="所有科目已隐藏"
                description="在科目管理中恢复需要展示的科目。"
                action-label="管理科目"
                embedded
                @action="subjectManagerOpen = true"
              />
            </div>

            <HomePracticeResources
              v-else
              :subject-code="activeSubject.code"
              @open-paper="openPaper"
              @loaded="browseScroll.restore()"
            />
          </div>
        </template>

        <ExamPlanSubjectsPopup
          v-model="subjectManagerOpen"
          :subjects="orderedSubjects"
          :active-subject-code="activeSubject?.code"
          :hidden-subject-codes="hiddenSubjectCodes"
          @select="selectSubject"
          @toggle-visibility="toggleSubjectVisibility"
          @move="moveSubject"
        />

        <PracticeSettingsPopup v-model="settingsPopupOpen" />

        <ExamPlanPopup v-model="examPlanPopupOpen" />
      </section>
    </PageContainer>
  </div>
</template>
