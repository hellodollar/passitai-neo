<script setup lang="ts">
import {
  AlertTriangle,
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
import { formatProfileScore, getPassItScoreColorClass } from '@/utils/practice/home-stats'
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
}> = [
  { key: 'baseline', label: '基准水平' },
  { key: 'pastExams', label: '真题水平' },
  { key: 'mockExams', label: '模拟考试水平' },
  { key: 'aiEnhance', label: '查漏补缺水平' },
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

const scoreColorClass = computed(() =>
  getPassItScoreColorClass(
    evidence.value?.masteryLevel ? { masteryLevel: evidence.value.masteryLevel } : null,
  ),
)

const summaryStats = computed(() => {
  const snapshot = evidence.value
  const accuracy =
    snapshot && snapshot.objectiveAnswered > 0
      ? `${Math.round((snapshot.objectiveCorrect / snapshot.objectiveAnswered) * 100)}%`
      : '—'
  return [
    {
      label: '近 7 日刷题',
      value: props.weeklyAnswered !== null ? String(props.weeklyAnswered) : '—',
    },
    // 接口暂未下发近 7 日错题量，先以中性占位符展示
    {
      label: '近 7 日错题',
      value: '—',
    },
    {
      label: '待清错题',
      value: snapshot ? String(snapshot.unresolvedMistakes) : '—',
    },
    {
      label: '正确率',
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
  }> = []

  for (const { key, label } of TRAINING_ABILITY_SLOTS) {
    const score = qs?.[key] ?? snapshot.slotScores?.[key]
    const level =
      snapshot.slotLevels?.[key] ?? (score !== undefined ? scoreToMasteryLevel(score) : undefined)
    if (level !== undefined) {
      items.push({ key, label, level })
    }
  }

  if (qs && qs.paperStructure !== undefined) {
    items.push({
      key: 'paperStructure',
      label: '题型结构水平',
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

function severityDotClass(severity: EvaluationGapSeverity) {
  if (severity === 'high') return 'bg-primary/70'
  if (severity === 'medium') return 'bg-info/70'
  return 'bg-base-content/30'
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
        class="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-base-200/70 px-4 py-3.5 dark:bg-base-100"
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
            <p class="text-sm font-medium text-base-content">还没有评估记录</p>
            <p class="text-xs text-base-content/55">点击下方按钮测一下当前水平</p>
          </div>

          <div v-else class="space-y-3.5">
            <!-- 第一层：核心评分卡 -->
            <section class="rounded-2xl bg-base-100 p-4 dark:bg-base-200">
              <div class="flex items-baseline justify-between gap-3">
                <div class="flex min-w-0 items-baseline gap-1.5">
                  <span class="text-sm font-semibold tracking-tight text-base-content">PassIt</span>
                  <span
                    class="text-[2rem] font-bold leading-none tracking-tight tabular-nums"
                    :class="scoreColorClass"
                  >
                    {{ formatProfileScore(activeEvaluation.estimatedScore) }}
                  </span>
                  <span class="text-xs font-medium text-base-content/50">分</span>
                </div>
                <span class="shrink-0 text-[11px] tabular-nums text-base-content/45">
                  {{ formatCompactTime(activeEvaluation.createdAt) }}
                </span>
              </div>

              <!-- PassIt 评分下方核心量：近 7 日刷题 / 近 7 日错题（占位） / 待清错题 / 正确率 -->
              <div class="mt-3.5 grid grid-cols-2 gap-2">
                <div
                  v-for="stat in summaryStats"
                  :key="stat.label"
                  class="flex items-baseline justify-between gap-2 rounded-xl bg-base-200/60 px-3 py-2.5 dark:bg-base-300/40"
                >
                  <span class="text-xs text-base-content/55">{{ stat.label }}</span>
                  <span class="text-sm font-semibold leading-none tabular-nums text-base-content">
                    {{ stat.value }}
                  </span>
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
                  <span>部分考点久未复习，复盘即可拉回分数</span>
                </p>
                <p
                  v-if="evidence?.subjectivePassCapped"
                  class="flex items-center gap-1.5 text-xs leading-snug text-base-content/55"
                >
                  <AlertTriangle :size="13" class="shrink-0" aria-hidden="true" />
                  <span>主观题练得较少，补练后估分更准</span>
                </p>
              </div>
            </section>

            <!-- 第二层：科目训练能力（显眼直出、不折叠、纯档位） -->
            <section
              v-if="trainingAbilityItems.length > 0"
              class="rounded-2xl bg-base-100 px-4 py-3.5 dark:bg-base-200"
            >
              <h4 class="mb-2 text-sm font-semibold tracking-tight text-base-content">
                科目训练能力
              </h4>

              <div class="divide-y divide-base-content/[0.06] dark:divide-base-content/[0.08]">
                <div
                  v-for="item in trainingAbilityItems"
                  :key="item.key"
                  class="flex items-center justify-between gap-3 py-2.5 first:pt-1 last:pb-0.5"
                >
                  <span class="text-sm font-medium text-base-content/85">
                    {{ item.label }}
                  </span>
                  <span
                    class="rounded-full px-2.5 py-0.5 text-xs font-medium"
                    :class="TRAINING_MASTERY_BADGE_CLASSES[item.level]"
                  >
                    {{ trainingMasteryLabels[item.level] }}
                  </span>
                </div>
              </div>
            </section>

            <!-- 第三层：诊断症状（所有薄弱表现集中置于下方） -->
            <section v-if="hasSymptoms">
              <h4 class="mb-2 px-1 text-xs font-medium text-base-content/55">诊断症状</h4>
              <div class="rounded-2xl bg-base-100 p-4 dark:bg-base-200">
                <!-- 具体问题列表 -->
                <div v-if="activeEvaluation.diagnosis.gaps.length > 0" class="space-y-2.5">
                  <div
                    v-for="(gap, index) in activeEvaluation.diagnosis.gaps"
                    :key="`${gap.code}-${index}`"
                    class="flex items-start gap-2.5"
                  >
                    <span
                      class="mt-1.5 size-1.5 shrink-0 rounded-full"
                      :class="severityDotClass(gap.severity)"
                      aria-hidden="true"
                    ></span>
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

            <!-- 第四层：提分建议（对应症状的直接行动） -->
            <section v-if="sortedRecommendations.length > 0">
              <h4 class="mb-2 px-1 text-xs font-medium text-base-content/55">提分建议</h4>
              <div
                class="divide-y divide-base-content/[0.06] overflow-hidden rounded-2xl bg-base-100 dark:divide-base-content/[0.08] dark:bg-base-200"
              >
                <div
                  v-for="(rec, index) in sortedRecommendations"
                  :key="`${rec.gapCode}-${rec.actionType}-${rec.paperId ?? index}`"
                  class="flex items-center justify-between gap-3 px-4 py-3"
                >
                  <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium leading-snug text-base-content">
                      {{ rec.title }}
                    </p>
                    <p
                      v-if="formatRecommendationSubtitle(rec)"
                      class="mt-0.5 text-xs leading-snug text-base-content/55"
                    >
                      {{ formatRecommendationSubtitle(rec) }}
                    </p>
                  </div>
                  <button
                    v-if="
                      (rec.actionType === 'paper' && rec.paperId) ||
                      rec.actionType === 'mistakes' ||
                      rec.actionType === 'aiGenerate'
                    "
                    type="button"
                    class="flex h-8 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-medium transition-colors disabled:opacity-50"
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
                    <Sparkles
                      v-else-if="rec.actionType === 'aiGenerate'"
                      :size="13"
                      aria-hidden="true"
                    />
                    <span>
                      {{
                        rec.actionType === 'paper'
                          ? '去刷题'
                          : rec.actionType === 'mistakes'
                            ? '去纠错'
                            : generatingIndex === index
                              ? '生成中'
                              : '去补强'
                      }}
                    </span>
                  </button>
                </div>
              </div>
            </section>

            <!-- 第五层：已掌握优势 -->
            <section v-if="activeEvaluation.diagnosis.strengths.length > 0">
              <h4 class="mb-2 px-1 text-xs font-medium text-base-content/55">已掌握</h4>
              <div class="space-y-2.5 rounded-2xl bg-base-100 p-4 dark:bg-base-200">
                <div
                  v-for="(strength, index) in activeEvaluation.diagnosis.strengths"
                  :key="`${strength.code}-${index}`"
                  class="flex items-start gap-2.5"
                >
                  <span
                    class="mt-1.5 size-1.5 shrink-0 rounded-full bg-success"
                    aria-hidden="true"
                  ></span>
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
            <p class="text-xs text-base-content/55">每次评估结果都会自动保存在这里</p>
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
