<script setup lang="ts">
import {
  AlertTriangle,
  BookOpen,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  Crosshair,
  FileClock,
  Gauge,
  Layers,
  ListChecks,
  RotateCcw,
  ScanSearch,
  Target,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  RefreshCw,
  Sparkles,
  X,
} from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  evaluateSubject,
  fetchSubjectEvaluations,
  generateAiEnhancePaper,
} from '@/api/subject-profile'
import BasePopup from '@/components/common/BasePopup.vue'
import { TRAINING_MASTERY_BADGE_CLASSES } from '@/constants/practice'
import { questionTypeLabels } from '@/generated/domain-values'
import {
  trainingMasteryLabels,
  type PracticeResourceType,
  type TrainingMasteryLevel,
} from '@/generated/practice-resource-values'
import { useAuthStore } from '@/stores/auth'
import type {
  EvaluationGapSeverity,
  GeneratedAiEnhancePaper,
  QuestionType,
  UserSubjectEvaluation,
  UserSubjectEvaluationRecommendation,
  UserSubjectProfile,
} from '@/types'
import { formatShanghaiDateTime } from '@/utils/date'
import { formatProfileScore } from '@/utils/practice/home-stats'
import { showErrorToast, showSuccessToast } from '@/utils/toast'

const props = withDefaults(
  defineProps<{
    subjectCode: string
    subjectName?: string
    profile?: UserSubjectProfile | null
    weeklyAnswered?: number | null
    initialEvaluation?: UserSubjectEvaluation | null
    initialTab?: 'detail' | 'history'
  }>(),
  {
    subjectName: '',
    profile: null,
    weeklyAnswered: null,
    initialEvaluation: null,
    initialTab: 'detail',
  },
)

const emit = defineEmits<{
  'open-paper': [paperId: string]
  'open-mistakes': []
  'ai-generated': [paper: GeneratedAiEnhancePaper]
  evaluated: [evaluation: UserSubjectEvaluation]
}>()

const model = defineModel<boolean>({ default: false })
const auth = useAuthStore()

const activeTab = ref<'detail' | 'history'>('detail')
const activeEvaluation = ref<UserSubjectEvaluation | null>(null)
const historyItems = ref<UserSubjectEvaluation[]>([])
const historyTotal = ref(0)
const historyPage = ref(0)
const historyLoading = ref(false)
const historyError = ref(false)
const evaluating = ref(false)
const generatingIndex = ref<number | null>(null)

let sessionSequence = 0
let historyController: AbortController | null = null

const HISTORY_LIMIT = 10

const TRAINING_ABILITY_SLOTS: ReadonlyArray<{
  key: PracticeResourceType
  label: string
  icon: typeof BookOpen
  tone: string
}> = [
  { key: 'baseline', label: '基础', icon: BookOpen, tone: 'text-primary/70' },
  { key: 'pastExams', label: '真题', icon: FileClock, tone: 'text-secondary/70' },
  { key: 'mockExams', label: '模拟', icon: ClipboardCheck, tone: 'text-info/70' },
  { key: 'aiEnhance', label: '补强', icon: ScanSearch, tone: 'text-ai/70' },
]

const canClose = computed(() => !evaluating.value && generatingIndex.value === null)

const headerTitle = computed(() => {
  if (activeTab.value === 'history') return '评估记录'
  return props.subjectName || '学习诊断'
})

const hasMoreHistory = computed(() => historyItems.value.length < historyTotal.value)

const sortedRecommendations = computed(() => {
  const list = activeEvaluation.value?.recommendations ?? []
  return [...list].sort((a, b) => a.priority - b.priority)
})

const evidence = computed(() => activeEvaluation.value?.evidenceSnapshot)

const summaryStats = computed(() => {
  const snapshot = evidence.value
  const accuracy =
    snapshot && snapshot.objectiveAnswered > 0
      ? `${Math.round((snapshot.objectiveCorrect / snapshot.objectiveAnswered) * 100)}%`
      : '—'
  return [
    {
      label: '7日练习',
      icon: BookOpen,
      value: props.weeklyAnswered !== null ? String(props.weeklyAnswered) : '—',
    },
    // 接口暂未下发7日错题量，先以中性占位符展示
    {
      label: '7日错题',
      icon: CircleX,
      value: '—',
    },
    {
      label: '待纠错',
      icon: RotateCcw,
      value: snapshot ? String(snapshot.unresolvedMistakes) : '—',
    },
    {
      label: '正确率',
      icon: Crosshair,
      value: accuracy,
    },
  ]
})

const memoryNeedsReview = computed(() => {
  const retention = evidence.value?.memoryRetention
  return retention !== undefined && retention < 0.95
})

const trainingAbilityItems = computed(() => {
  const snapshot = evidence.value
  if (!snapshot) return []
  const qs = snapshot.quickScore
  const items: Array<{
    key: string
    label: string
    level: TrainingMasteryLevel
    icon: typeof BookOpen
    tone: string
  }> = []

  for (const { key, label, icon, tone } of TRAINING_ABILITY_SLOTS) {
    const score = qs?.[key] ?? snapshot.slotScores?.[key]
    const level =
      snapshot.slotLevels?.[key] ?? (score !== undefined ? scoreToMasteryLevel(score) : undefined)
    if (level !== undefined) {
      items.push({ key, label, level, icon, tone })
    }
  }

  if (qs && qs.paperStructure !== undefined) {
    items.push({
      key: 'paperStructure',
      label: '题型',
      icon: Layers,
      tone: 'text-accent/70',
      level: scoreToMasteryLevel(qs.paperStructure),
    })
  }

  return items
})

const weakness = computed(() => evidence.value?.weaknessProfile)

const hasWeaknessProfile = computed(() => {
  const w = weakness.value
  if (!w) return false
  return (
    w.weakQuestionTypes.length > 0 ||
    w.weakPointKeys.length > 0 ||
    w.stalePointKeys.length > 0 ||
    w.stubbornMistakeCount > 0 ||
    w.confusionMistakeCount > 0
  )
})

const hasSymptoms = computed(
  () => (activeEvaluation.value?.diagnosis.gaps.length ?? 0) > 0 || hasWeaknessProfile.value,
)

function scoreToMasteryLevel(score: number): TrainingMasteryLevel {
  if (score >= 85) return 'mastered'
  if (score >= 70) return 'familiar'
  if (score >= 50) return 'aware'
  return 'weak'
}

function formatCompactTime(iso: string) {
  const full = formatShanghaiDateTime(iso)
  const currentYear = `${new Date().getFullYear()}-`
  return full.startsWith(currentYear) ? full.slice(currentYear.length) : full
}

function severityIconClass(severity: EvaluationGapSeverity) {
  if (severity === 'high') return 'bg-primary/10 text-primary'
  if (severity === 'medium') return 'bg-info/10 text-info'
  return 'bg-base-200/65 text-base-content/55 dark:bg-base-300/45'
}

function getPointWrongCount(pointKey: string) {
  return props.profile?.pointStats[pointKey]?.wrongCount ?? 0
}

function getQuestionTypeWrongCount(type: QuestionType) {
  return props.profile?.questionTypeStats[type]?.wrongCount ?? 0
}

function formatRecommendationSubtitle(rec: UserSubjectEvaluationRecommendation) {
  const parts: string[] = []
  if (rec.questionTypes?.length) {
    parts.push(`专攻 ${rec.questionTypes.map((qt) => questionTypeLabels[qt]).join('、')}`)
  }
  if (rec.reason) parts.push(rec.reason)
  return parts.join(' · ')
}

function scoreDelta(index: number) {
  const current = historyItems.value[index]
  const previous = historyItems.value[index + 1]
  if (!current || !previous) return null
  const delta = Math.round((current.estimatedScore - previous.estimatedScore) * 10) / 10
  return delta === 0 ? null : delta
}

function cancelPendingRequests() {
  sessionSequence++
  historyController?.abort()
  historyController = null
  historyLoading.value = false
  evaluating.value = false
  generatingIndex.value = null
}

async function loadHistory(page = 1) {
  if (!props.subjectCode || !auth.session?.token) return
  if (historyLoading.value && page > 1) return

  historyController?.abort()
  const controller = new AbortController()
  historyController = controller
  const sequence = sessionSequence
  const token = auth.session.token
  const code = props.subjectCode

  historyLoading.value = true
  historyError.value = false
  try {
    const res = await fetchSubjectEvaluations(
      code,
      { page, limit: HISTORY_LIMIT },
      controller.signal,
    )
    if (
      controller.signal.aborted ||
      sequence !== sessionSequence ||
      token !== auth.session?.token ||
      code !== props.subjectCode
    ) {
      return
    }
    if (page === 1) {
      historyItems.value = res.items
      if (!activeEvaluation.value && res.items[0]) {
        activeEvaluation.value = res.items[0]
      }
    } else {
      const seen = new Set(historyItems.value.map((item) => item.id))
      historyItems.value = [
        ...historyItems.value,
        ...res.items.filter((item) => !seen.has(item.id)),
      ]
    }
    historyTotal.value = res.total
    historyPage.value = page
  } catch {
    if (!controller.signal.aborted && sequence === sessionSequence) {
      historyError.value = true
    }
  } finally {
    if (historyController === controller) historyController = null
    if (!controller.signal.aborted && sequence === sessionSequence) {
      historyLoading.value = false
    }
  }
}

async function runManualEvaluation() {
  if (!props.subjectCode || !auth.session?.token || evaluating.value) return
  const sequence = sessionSequence
  const token = auth.session.token
  const code = props.subjectCode

  evaluating.value = true
  try {
    const evaluation = await evaluateSubject(code, { triggerType: 'manual' })
    if (
      sequence !== sessionSequence ||
      token !== auth.session?.token ||
      code !== props.subjectCode
    ) {
      return
    }
    activeEvaluation.value = evaluation
    activeTab.value = 'detail'
    historyItems.value = [
      evaluation,
      ...historyItems.value.filter((item) => item.id !== evaluation.id),
    ]
    historyTotal.value = Math.max(historyTotal.value + 1, historyItems.value.length)
    emit('evaluated', evaluation)
    showSuccessToast('已更新评分')
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    if (sequence === sessionSequence) evaluating.value = false
  }
}

async function handleRecommendation(rec: UserSubjectEvaluationRecommendation, index: number) {
  if (rec.actionType === 'paper' && rec.paperId) {
    model.value = false
    emit('open-paper', rec.paperId)
    return
  }
  if (rec.actionType === 'mistakes') {
    model.value = false
    emit('open-mistakes')
    return
  }
  if (rec.actionType === 'aiGenerate') {
    if (generatingIndex.value !== null || !props.subjectCode || !auth.session?.token) return
    const sequence = sessionSequence
    const token = auth.session.token
    const code = props.subjectCode
    generatingIndex.value = index
    try {
      const paper = await generateAiEnhancePaper(code, {
        enhanceType: rec.enhanceType ?? 'pointWeak',
        pointKeys: rec.pointKeys?.length ? rec.pointKeys.slice(0, 10) : undefined,
        questionTypes: rec.questionTypes?.length ? rec.questionTypes.slice(0, 6) : undefined,
      })
      if (
        sequence !== sessionSequence ||
        token !== auth.session?.token ||
        code !== props.subjectCode
      ) {
        return
      }
      showSuccessToast(`已生成「${paper.name}」`)
      emit('ai-generated', paper)
      model.value = false
      emit('open-paper', paper.id)
    } catch (error) {
      if (sequence === sessionSequence && error instanceof Error && !error.message) {
        showErrorToast('生成练习失败')
      }
    } finally {
      if (sequence === sessionSequence) generatingIndex.value = null
    }
  }
}

function selectHistoryItem(item: UserSubjectEvaluation) {
  activeEvaluation.value = item
  activeTab.value = 'detail'
}

watch(
  [model, () => props.subjectCode, () => props.initialEvaluation],
  ([open]) => {
    cancelPendingRequests()
    if (!open) return
    activeTab.value = props.initialTab
    activeEvaluation.value = props.initialEvaluation ?? null
    historyItems.value = props.initialEvaluation ? [props.initialEvaluation] : []
    historyTotal.value = historyItems.value.length
    historyPage.value = 0
    historyError.value = false
    if (props.initialTab === 'history' || !props.initialEvaluation) {
      void loadHistory(1)
    }
  },
  { immediate: true },
)

watch(activeTab, (tab) => {
  if (model.value && tab === 'history' && historyPage.value === 0 && !historyLoading.value) {
    void loadHistory(1)
  }
})

watch(
  () => auth.session?.token,
  () => {
    model.value = false
    cancelPendingRequests()
    activeEvaluation.value = null
    historyItems.value = []
    historyTotal.value = 0
    historyPage.value = 0
  },
)

onBeforeUnmount(cancelPendingRequests)
</script>

<template>
  <BasePopup
    v-model="model"
    :title="headerTitle"
    box-class="h-[min(84dvh,44rem)]"
    :close-on-backdrop="canClose"
    :close-on-escape="canClose"
  >
    <template #header>
      <div
        class="grid shrink-0 grid-cols-[4.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 border-b border-base-content/[0.06] px-3 py-2.5 dark:border-base-content/[0.08]"
      >
        <div class="flex items-center">
          <button
            v-if="activeTab === 'history'"
            type="button"
            class="inline-flex h-8 items-center gap-0.5 rounded-lg px-1.5 text-xs font-medium text-primary transition-colors active:bg-primary/10"
            @click="activeTab = 'detail'"
          >
            <ChevronLeft :size="16" aria-hidden="true" />
            返回
          </button>
          <button
            v-else
            type="button"
            class="inline-flex h-8 items-center gap-1 rounded-lg px-2 text-xs font-medium text-base-content/60 transition-colors active:bg-base-200/70 dark:active:bg-base-300/50"
            @click="activeTab = 'history'"
          >
            <History :size="14" aria-hidden="true" />
            历史
          </button>
        </div>

        <h3
          class="truncate text-center text-[15px] font-semibold leading-tight tracking-tight text-base-content"
        >
          {{ headerTitle }}
        </h3>

        <div class="flex items-center justify-end">
          <button
            type="button"
            class="flex size-8 items-center justify-center rounded-full text-base-content/55 transition-colors active:bg-base-200/60 disabled:opacity-40 dark:active:bg-base-300/50"
            aria-label="关闭"
            :disabled="!canClose"
            @click="canClose && (model = false)"
          >
            <X :size="16" />
          </button>
        </div>
      </div>
    </template>

    <template #body>
      <div
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-base-200/70 px-4 py-3 dark:bg-base-100"
      >
        <!-- 诊断详情 -->
        <template v-if="activeTab === 'detail'">
          <div
            v-if="historyLoading && !activeEvaluation"
            class="flex min-h-52 flex-col items-center justify-center gap-2 text-center"
            role="status"
          >
            <span class="loading loading-spinner loading-md text-primary" aria-hidden="true"></span>
            <p class="text-xs text-base-content/55">加载中…</p>
          </div>

          <div
            v-else-if="historyError && !activeEvaluation"
            class="flex min-h-52 flex-col items-center justify-center gap-2.5 text-center"
            role="alert"
          >
            <p class="text-xs font-medium text-error">加载失败</p>
            <button
              type="button"
              class="h-8 rounded-lg bg-error/10 px-3 text-xs font-medium text-error active:bg-error/15"
              @click="loadHistory(1)"
            >
              重试
            </button>
          </div>

          <div
            v-else-if="!activeEvaluation"
            class="flex min-h-52 flex-col items-center justify-center gap-1.5 text-center"
          >
            <p class="text-sm font-medium text-base-content">暂无评估</p>
            <p class="text-xs text-base-content/55">开始评估，了解当前水平</p>
          </div>

          <div v-else class="space-y-2.5">
            <!-- 第一层：分数使用品牌色强调；掌握度含义仍由下方等级标签表达。 -->
            <section
              class="overflow-hidden rounded-2xl bg-base-100 p-3 dark:bg-base-200"
              aria-label="PassIt 综合评分"
            >
              <div
                class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 rounded-xl bg-primary/5 px-3 py-2.5 dark:bg-primary/10"
              >
                <div class="flex items-center gap-1.5">
                  <Sparkles :size="14" class="text-primary" aria-hidden="true" />
                  <span class="text-sm font-semibold tracking-tight text-primary">PassIt</span>
                  <span
                    class="ml-1 bg-linear-to-br from-primary to-ai bg-clip-text text-4xl font-semibold leading-none tracking-tighter text-transparent tabular-nums"
                  >
                    {{ formatProfileScore(activeEvaluation.estimatedScore) }}
                  </span>
                  <span class="self-end pb-0.5 text-xs text-base-content/55">分</span>
                </div>
                <span
                  class="inline-flex items-center gap-1 text-[11px] tabular-nums text-base-content/55"
                >
                  <Clock :size="12" aria-hidden="true" />
                  {{ formatCompactTime(activeEvaluation.createdAt) }}
                </span>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-1.5">
                <div
                  v-for="stat in summaryStats"
                  :key="stat.label"
                  class="flex min-w-0 items-center justify-between gap-1.5 rounded-lg bg-base-200/65 px-2.5 py-2 dark:bg-base-300/45"
                >
                  <span
                    class="flex min-w-0 items-center gap-1 text-[11px] leading-snug text-base-content/55"
                  >
                    <component
                      :is="stat.icon"
                      :size="12"
                      class="text-base-content/40"
                      aria-hidden="true"
                    />
                    {{ stat.label }}
                  </span>
                  <span
                    class="shrink-0 text-base font-semibold leading-none tabular-nums text-base-content"
                    >{{ stat.value }}</span
                  >
                </div>
              </div>

              <div
                v-if="memoryNeedsReview || evidence?.subjectivePassCapped"
                class="mt-3 space-y-1.5"
              >
                <p
                  v-if="memoryNeedsReview"
                  class="flex items-center gap-1.5 text-xs leading-snug text-base-content/55"
                >
                  <Clock :size="13" class="shrink-0" aria-hidden="true" />
                  <span>部分考点待复习</span>
                </p>
                <p
                  v-if="evidence?.subjectivePassCapped"
                  class="flex items-center gap-1.5 text-xs leading-snug text-base-content/55"
                >
                  <AlertTriangle :size="13" class="shrink-0" aria-hidden="true" />
                  <span>主观题样本偏少，建议补练</span>
                </p>
              </div>
            </section>

            <!-- 第二层：训练能力（显眼直出、不折叠、纯档位） -->
            <section
              v-if="trainingAbilityItems.length > 0"
              class="rounded-2xl bg-base-100 px-3 py-2.5 dark:bg-base-200"
            >
              <h4
                class="mb-2 flex items-center gap-2 text-[15px] font-semibold leading-tight tracking-tight text-base-content"
              >
                <span
                  class="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary"
                  aria-hidden="true"
                  ><Gauge :size="15"
                /></span>
                训练能力
              </h4>

              <div class="divide-y divide-base-content/[0.06] dark:divide-base-content/[0.08]">
                <div
                  v-for="item in trainingAbilityItems"
                  :key="item.key"
                  class="flex items-center justify-between gap-2 py-1.5 first:pt-0.5 last:pb-0.5"
                >
                  <div class="flex min-w-0 items-center gap-2">
                    <span
                      class="flex size-5 shrink-0 items-center justify-center"
                      :class="item.tone"
                      aria-hidden="true"
                      ><component :is="item.icon" :size="15"
                    /></span>
                    <span class="text-sm font-medium leading-snug text-base-content">{{
                      item.label
                    }}</span>
                  </div>
                  <span
                    class="shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold"
                    :class="TRAINING_MASTERY_BADGE_CLASSES[item.level]"
                  >
                    {{ trainingMasteryLabels[item.level] }}
                  </span>
                </div>
              </div>
            </section>

            <!-- 第三层：待提升（所有薄弱表现集中置于下方） -->
            <section v-if="hasSymptoms">
              <h4
                class="mb-2 flex items-center gap-1.5 px-1 text-[15px] font-semibold leading-tight tracking-tight text-base-content"
              >
                <span
                  class="flex size-7 items-center justify-center rounded-lg bg-secondary/10 text-secondary"
                  aria-hidden="true"
                  ><ScanSearch :size="15"
                /></span>
                待提升
              </h4>
              <div class="rounded-2xl bg-base-100 p-3 dark:bg-base-200">
                <!-- 具体问题列表 -->
                <div v-if="activeEvaluation.diagnosis.gaps.length > 0" class="space-y-2.5">
                  <div
                    v-for="(gap, index) in activeEvaluation.diagnosis.gaps"
                    :key="`${gap.code}-${index}`"
                    class="flex items-start gap-2.5"
                  >
                    <span
                      class="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md"
                      :class="severityIconClass(gap.severity)"
                      aria-hidden="true"
                      ><Target :size="12"
                    /></span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium leading-snug text-base-content">
                        {{ gap.title }}
                      </p>
                      <p class="mt-0.5 text-xs text-base-content/55">
                        {{ gap.current }} → {{ gap.target }}
                      </p>
                    </div>
                  </div>
                </div>

                <!-- 错题与考点特征 -->
                <div
                  v-if="hasWeaknessProfile && weakness"
                  class="space-y-3"
                  :class="
                    activeEvaluation.diagnosis.gaps.length > 0
                      ? 'mt-3.5 border-t border-base-content/[0.06] pt-3.5 dark:border-base-content/[0.08]'
                      : ''
                  "
                >
                  <div v-if="weakness.weakQuestionTypes.length > 0">
                    <p class="mb-1.5 text-[11px] font-medium text-base-content/50">丢分题型</p>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="qt in weakness.weakQuestionTypes"
                        :key="qt"
                        class="rounded-full bg-base-200/75 px-2.5 py-0.5 text-xs font-medium text-base-content/80 dark:bg-base-300/50"
                      >
                        {{ questionTypeLabels[qt]
                        }}<template v-if="getQuestionTypeWrongCount(qt) > 0">
                          <span class="ml-1 tabular-nums text-base-content/50">
                            错{{ getQuestionTypeWrongCount(qt) }}次
                          </span>
                        </template>
                      </span>
                    </div>
                  </div>

                  <div v-if="weakness.weakPointKeys.length > 0">
                    <p class="mb-1.5 text-[11px] font-medium text-base-content/50">薄弱考点</p>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="point in weakness.weakPointKeys.slice(0, 6)"
                        :key="point"
                        class="rounded-full bg-base-200/75 px-2.5 py-0.5 text-xs text-base-content/80 dark:bg-base-300/50"
                      >
                        {{ point
                        }}<template v-if="getPointWrongCount(point) > 0">
                          <span class="ml-1 tabular-nums text-base-content/50">
                            错{{ getPointWrongCount(point) }}次
                          </span>
                        </template>
                      </span>
                      <span
                        v-if="weakness.weakPointKeys.length > 6"
                        class="rounded-full bg-base-200/75 px-2 py-0.5 text-[11px] tabular-nums text-base-content/50 dark:bg-base-300/50"
                      >
                        +{{ weakness.weakPointKeys.length - 6 }}
                      </span>
                    </div>
                  </div>

                  <div v-if="weakness.stalePointKeys.length > 0">
                    <p class="mb-1.5 text-[11px] font-medium text-base-content/50">久未复习</p>
                    <div class="flex flex-wrap gap-1.5">
                      <span
                        v-for="point in weakness.stalePointKeys.slice(0, 6)"
                        :key="point"
                        class="rounded-full bg-info/10 px-2.5 py-0.5 text-xs text-info dark:bg-info/15"
                      >
                        {{ point }}
                      </span>
                      <span
                        v-if="weakness.stalePointKeys.length > 6"
                        class="rounded-full bg-info/10 px-2 py-0.5 text-[11px] tabular-nums text-info dark:bg-info/15"
                      >
                        +{{ weakness.stalePointKeys.length - 6 }}
                      </span>
                    </div>
                  </div>

                  <p
                    v-if="weakness.stubbornMistakeCount > 0 || weakness.confusionMistakeCount > 0"
                    class="text-xs tabular-nums text-base-content/60"
                  >
                    <template v-if="weakness.stubbornMistakeCount > 0">
                      反复做错
                      <span class="font-semibold text-base-content">{{
                        weakness.stubbornMistakeCount
                      }}</span>
                      题
                    </template>
                    <template
                      v-if="weakness.stubbornMistakeCount > 0 && weakness.confusionMistakeCount > 0"
                    >
                      ·
                    </template>
                    <template v-if="weakness.confusionMistakeCount > 0">
                      易混淆
                      <span class="font-semibold text-base-content">{{
                        weakness.confusionMistakeCount
                      }}</span>
                      题
                    </template>
                  </p>
                </div>
              </div>
            </section>

            <!-- 第四层：下一步（对应症状的直接行动） -->
            <section v-if="sortedRecommendations.length > 0">
              <h4
                class="mb-2 flex items-center gap-1.5 px-1 text-[15px] font-semibold leading-tight tracking-tight text-base-content"
              >
                <span
                  class="flex size-7 items-center justify-center rounded-lg bg-ai/10 text-ai"
                  aria-hidden="true"
                  ><TrendingUp :size="15"
                /></span>
                下一步
              </h4>
              <div
                class="divide-y divide-base-content/[0.06] overflow-hidden rounded-2xl bg-base-100 dark:divide-base-content/[0.08] dark:bg-base-200"
              >
                <div
                  v-for="(rec, index) in sortedRecommendations"
                  :key="`${rec.gapCode}-${rec.actionType}-${rec.paperId ?? index}`"
                  class="flex flex-wrap items-center gap-x-2.5 gap-y-2 px-3 py-2.5"
                >
                  <div class="flex min-w-0 flex-[1_1_9rem] items-start gap-2">
                    <span
                      class="mt-0.5 flex size-5 shrink-0 items-center justify-center"
                      :class="
                        rec.actionType === 'aiGenerate'
                          ? 'text-ai/70'
                          : rec.actionType === 'mistakes'
                            ? 'text-secondary/70'
                            : 'text-primary/70'
                      "
                      aria-hidden="true"
                    >
                      <component
                        :is="
                          rec.actionType === 'aiGenerate'
                            ? Sparkles
                            : rec.actionType === 'mistakes'
                              ? RotateCcw
                              : ListChecks
                        "
                        :size="14"
                      />
                    </span>
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium leading-snug text-base-content">
                        {{ rec.title }}
                      </p>
                      <p
                        v-if="formatRecommendationSubtitle(rec)"
                        class="mt-1 text-xs leading-relaxed text-base-content/55"
                      >
                        {{ formatRecommendationSubtitle(rec) }}
                      </p>
                    </div>
                  </div>
                  <button
                    v-if="
                      (rec.actionType === 'paper' && rec.paperId) ||
                      rec.actionType === 'mistakes' ||
                      rec.actionType === 'aiGenerate'
                    "
                    type="button"
                    class="ml-auto flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-50"
                    :class="
                      rec.actionType === 'aiGenerate'
                        ? 'bg-ai/10 text-ai active:bg-ai/15 dark:bg-ai/15'
                        : 'bg-primary/10 text-primary active:bg-primary/15 dark:bg-primary/15'
                    "
                    :disabled="generatingIndex !== null"
                    @click="handleRecommendation(rec, index)"
                  >
                    <span
                      v-if="generatingIndex === index"
                      class="loading loading-spinner loading-xs"
                      aria-hidden="true"
                    ></span>
                    <span>
                      {{
                        rec.actionType === 'paper'
                          ? '练习'
                          : rec.actionType === 'mistakes'
                            ? '纠错'
                            : generatingIndex === index
                              ? '生成中'
                              : '补强'
                      }}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <!-- 第五层：已掌握优势 -->
            <section v-if="activeEvaluation.diagnosis.strengths.length > 0">
              <h4
                class="mb-2 flex items-center gap-1.5 px-1 text-[15px] font-semibold leading-tight tracking-tight text-base-content"
              >
                <span
                  class="flex size-7 items-center justify-center rounded-lg bg-success/10 text-success"
                  aria-hidden="true"
                  ><CircleCheck :size="15"
                /></span>
                已掌握
              </h4>
              <div class="space-y-2 rounded-2xl bg-base-100 p-3 dark:bg-base-200">
                <div
                  v-for="(strength, index) in activeEvaluation.diagnosis.strengths"
                  :key="`${strength.code}-${index}`"
                  class="flex items-start gap-2.5"
                >
                  <span
                    class="mt-0.5 flex size-5 shrink-0 items-center justify-center text-success/70"
                    aria-hidden="true"
                    ><CircleCheck :size="14"
                  /></span>
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium leading-snug text-base-content">
                      {{ strength.title }}
                    </p>
                    <p class="mt-0.5 text-xs leading-snug text-base-content/55">
                      {{ strength.detail }}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </template>

        <!-- 历史记录 -->
        <template v-else>
          <div
            v-if="historyLoading && historyItems.length === 0"
            class="flex min-h-52 flex-col items-center justify-center gap-2 text-center"
            role="status"
          >
            <span class="loading loading-spinner loading-md text-primary" aria-hidden="true"></span>
            <p class="text-xs text-base-content/55">加载中…</p>
          </div>

          <div
            v-else-if="historyError && historyItems.length === 0"
            class="flex min-h-52 flex-col items-center justify-center gap-2.5 text-center"
            role="alert"
          >
            <p class="text-xs font-medium text-error">加载失败</p>
            <button
              type="button"
              class="h-8 rounded-lg bg-error/10 px-3 text-xs font-medium text-error active:bg-error/15"
              @click="loadHistory(1)"
            >
              重试
            </button>
          </div>

          <div
            v-else-if="historyItems.length === 0"
            class="flex min-h-52 flex-col items-center justify-center gap-1.5 text-center"
          >
            <p class="text-sm font-medium text-base-content">暂无评估记录</p>
            <p class="text-xs text-base-content/55">评估结果自动保存</p>
          </div>

          <div v-else class="space-y-3">
            <div
              class="divide-y divide-base-content/[0.06] overflow-hidden rounded-2xl bg-base-100 dark:divide-base-content/[0.08] dark:bg-base-200"
            >
              <button
                v-for="(item, index) in historyItems"
                :key="item.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors active:bg-base-200/60 dark:active:bg-base-300/50"
                :class="
                  activeEvaluation?.id === item.id ? 'bg-primary/[0.06] dark:bg-primary/10' : ''
                "
                @click="selectHistoryItem(item)"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="text-base font-semibold tabular-nums text-base-content">
                      {{ formatProfileScore(item.estimatedScore) }} 分
                    </span>
                    <span
                      v-if="scoreDelta(index) !== null"
                      class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                      :class="
                        scoreDelta(index)! > 0
                          ? 'bg-success/10 text-success'
                          : 'bg-base-200/80 text-base-content/55 dark:bg-base-300/50'
                      "
                    >
                      {{ scoreDelta(index)! > 0 ? `+${scoreDelta(index)}` : scoreDelta(index) }}
                    </span>
                  </div>
                  <p class="mt-1 text-xs tabular-nums text-base-content/45">
                    {{ formatCompactTime(item.createdAt) }}
                  </p>
                </div>
                <ChevronRight :size="15" class="shrink-0 text-base-content/30" aria-hidden="true" />
              </button>
            </div>

            <div v-if="hasMoreHistory" class="text-center">
              <button
                type="button"
                class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-base-100 px-4 text-xs font-medium text-base-content/70 transition-colors active:bg-base-200 disabled:opacity-50 dark:bg-base-200"
                :disabled="historyLoading"
                @click="loadHistory(historyPage + 1)"
              >
                <span
                  v-if="historyLoading"
                  class="loading loading-spinner loading-xs"
                  aria-hidden="true"
                ></span>
                {{ historyLoading ? '加载中…' : '加载更多' }}
              </button>
            </div>
          </div>
        </template>
      </div>
    </template>

    <template #footer>
      <button
        type="button"
        class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-content transition-colors active:opacity-90 disabled:opacity-50"
        :disabled="evaluating || generatingIndex !== null || !subjectCode"
        @click="runManualEvaluation"
      >
        <span
          v-if="evaluating"
          class="loading loading-spinner loading-xs"
          aria-hidden="true"
        ></span>
        <RefreshCw v-else :size="15" aria-hidden="true" />
        {{ evaluating ? '评估中…' : activeEvaluation ? '重新评估' : '开始评估' }}
      </button>
    </template>
  </BasePopup>
</template>
