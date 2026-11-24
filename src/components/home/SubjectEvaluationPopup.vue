<script setup lang="ts">
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  History,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import {
  evaluateSubject,
  fetchSubjectEvaluations,
  generateAiEnhancePaper,
} from '@/api/subject-profile'
import BasePopup from '@/components/common/BasePopup.vue'
import {
  EVALUATION_CONFIDENCE_LABELS,
  EVALUATION_READINESS_META,
  EVALUATION_TRIGGER_LABELS,
  PRACTICE_RESOURCE_SLOT_FALLBACK_LABELS,
  TRAINING_MASTERY_BADGE_CLASSES,
} from '@/constants/practice'
import {
  aiEnhanceLabels,
  practiceResourceTypes,
  trainingMasteryLabels,
} from '@/generated/practice-resource-values'
import { useAuthStore } from '@/stores/auth'
import type {
  EvaluationGapSeverity,
  GeneratedAiEnhancePaper,
  UserSubjectEvaluation,
  UserSubjectEvaluationRecommendation,
} from '@/types'
import { showErrorToast, showSuccessToast } from '@/utils/toast'

const props = withDefaults(
  defineProps<{
    subjectCode: string
    subjectName?: string
    initialEvaluation?: UserSubjectEvaluation | null
    initialTab?: 'detail' | 'history'
  }>(),
  {
    subjectName: '',
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

const hasMoreHistory = computed(() => historyItems.value.length < historyTotal.value)

const sortedRecommendations = computed(() => {
  const list = activeEvaluation.value?.recommendations ?? []
  return [...list].sort((a, b) => a.priority - b.priority)
})

const slotEntries = computed(() => {
  const evidence = activeEvaluation.value?.evidenceSnapshot
  if (!evidence?.slotScores && !evidence?.slotLevels) return []
  return practiceResourceTypes
    .filter(
      (type) =>
        evidence.slotScores?.[type] !== undefined || evidence.slotLevels?.[type] !== undefined,
    )
    .map((type) => ({
      type,
      label: PRACTICE_RESOURCE_SLOT_FALLBACK_LABELS[type],
      score: evidence.slotScores?.[type],
      level: evidence.slotLevels?.[type],
    }))
})

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  return `${month}-${day} ${hours}:${minutes}`
}

function severityMeta(severity: EvaluationGapSeverity) {
  if (severity === 'high') {
    return { label: '高优先', badgeClass: 'bg-error/10 text-error dark:bg-error/15' }
  }
  if (severity === 'medium') {
    return { label: '中优先', badgeClass: 'bg-warning/10 text-warning dark:bg-warning/15' }
  }
  return { label: '建议优化', badgeClass: 'bg-info/10 text-info dark:bg-info/15' }
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
    showSuccessToast('已完成最新科目评估')
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
        showErrorToast('生成补强卷失败')
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
    :title="subjectName ? `${subjectName} · 评估诊断` : '科目评估诊断'"
    box-class="h-[min(82dvh,42rem)]"
    :close-on-backdrop="!evaluating && generatingIndex === null"
    :close-on-escape="!evaluating && generatingIndex === null"
  >
    <template #body>
      <div class="flex min-h-0 flex-1 flex-col">
        <div class="shrink-0 px-4 pt-3">
          <div
            class="grid grid-cols-2 rounded-xl bg-base-200/65 p-1 dark:bg-base-300/45"
            role="tablist"
            aria-label="评估视图"
          >
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'detail'"
              class="flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs transition-colors"
              :class="
                activeTab === 'detail'
                  ? 'bg-base-100 font-semibold text-primary dark:bg-base-200'
                  : 'font-medium text-base-content/70'
              "
              @click="activeTab = 'detail'"
            >
              <TrendingUp :size="14" aria-hidden="true" />
              评估诊断
            </button>
            <button
              type="button"
              role="tab"
              :aria-selected="activeTab === 'history'"
              class="flex h-8 items-center justify-center gap-1.5 rounded-lg text-xs transition-colors"
              :class="
                activeTab === 'history'
                  ? 'bg-base-100 font-semibold text-primary dark:bg-base-200'
                  : 'font-medium text-base-content/70'
              "
              @click="activeTab = 'history'"
            >
              <History :size="14" aria-hidden="true" />
              历史记录
            </button>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3.5">
          <!-- 评估诊断详情 -->
          <template v-if="activeTab === 'detail'">
            <div
              v-if="historyLoading && !activeEvaluation"
              class="flex min-h-48 flex-col items-center justify-center gap-2 text-center"
              role="status"
            >
              <span
                class="loading loading-spinner loading-md text-primary"
                aria-hidden="true"
              ></span>
              <p class="text-xs font-medium text-base-content/55">正在加载评估记录…</p>
            </div>

            <div
              v-else-if="historyError && !activeEvaluation"
              class="flex min-h-48 flex-col items-center justify-center gap-2.5 text-center"
              role="alert"
            >
              <p class="text-xs font-medium text-error">评估记录加载失败</p>
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
              class="flex min-h-48 flex-col items-center justify-center gap-2 text-center"
            >
              <p class="text-sm font-medium text-base-content">暂无评估快照</p>
              <p class="text-xs text-base-content/55">点击下方按钮立即生成本科目规则估分与诊断</p>
            </div>

            <div v-else class="space-y-4">
              <!-- 综合估分卡片 -->
              <section class="rounded-xl bg-base-200/65 p-3.5 dark:bg-base-300/45">
                <div class="flex items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex items-baseline gap-1">
                      <span class="text-3xl font-semibold leading-none tabular-nums text-primary">
                        {{ activeEvaluation.estimatedScore }}
                      </span>
                      <span class="text-xs font-medium text-base-content/55">分（规则估分）</span>
                    </div>
                    <p
                      v-if="
                        activeEvaluation.objectiveEstimatedScore !== null ||
                        activeEvaluation.subjectiveEstimatedScore !== null
                      "
                      class="mt-1.5 text-xs tabular-nums text-base-content/55"
                    >
                      <template v-if="activeEvaluation.objectiveEstimatedScore !== null">
                        客观 {{ activeEvaluation.objectiveEstimatedScore }} 分
                      </template>
                      <template
                        v-if="
                          activeEvaluation.objectiveEstimatedScore !== null &&
                          activeEvaluation.subjectiveEstimatedScore !== null
                        "
                      >
                        ·
                      </template>
                      <template v-if="activeEvaluation.subjectiveEstimatedScore !== null">
                        主观 {{ activeEvaluation.subjectiveEstimatedScore }} 分
                      </template>
                    </p>
                  </div>

                  <div class="flex shrink-0 flex-col items-end gap-1">
                    <span
                      class="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                      :class="EVALUATION_READINESS_META[activeEvaluation.readinessLevel].badgeClass"
                    >
                      {{ EVALUATION_READINESS_META[activeEvaluation.readinessLevel].label }}
                    </span>
                    <span class="text-[11px] tabular-nums text-base-content/55">
                      {{ EVALUATION_CONFIDENCE_LABELS[activeEvaluation.confidence] }} ·
                      {{ EVALUATION_TRIGGER_LABELS[activeEvaluation.triggerType] }}
                    </span>
                  </div>
                </div>

                <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span
                    v-if="activeEvaluation.evidenceSnapshot.masteryLevel"
                    class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    :class="
                      TRAINING_MASTERY_BADGE_CLASSES[activeEvaluation.evidenceSnapshot.masteryLevel]
                    "
                  >
                    能力档位：{{
                      trainingMasteryLabels[activeEvaluation.evidenceSnapshot.masteryLevel]
                    }}
                  </span>
                  <span class="text-[11px] tabular-nums text-base-content/55">
                    {{ formatDateTime(activeEvaluation.createdAt) }}
                  </span>
                </div>

                <p
                  v-if="activeEvaluation.diagnosis.summary"
                  class="mt-2.5 border-t border-base-content/[0.06] pt-2.5 text-xs leading-relaxed text-base-content/75 dark:border-base-content/[0.08]"
                >
                  {{ activeEvaluation.diagnosis.summary }}
                </p>
              </section>

              <!-- 四槽位得分 -->
              <section v-if="slotEntries.length > 0">
                <h4 class="mb-2 text-xs font-medium text-base-content/55">四槽位评估状态</h4>
                <div class="grid grid-cols-4 gap-2">
                  <div
                    v-for="slot in slotEntries"
                    :key="slot.type"
                    class="rounded-xl bg-base-200/65 px-2 py-2.5 text-center dark:bg-base-300/45"
                  >
                    <p class="truncate text-[11px] font-medium text-base-content/55">
                      {{ slot.label }}
                    </p>
                    <p class="mt-1 text-sm font-semibold tabular-nums text-base-content">
                      {{ slot.score !== undefined ? slot.score : '—' }}
                    </p>
                    <span
                      v-if="slot.level"
                      class="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none"
                      :class="TRAINING_MASTERY_BADGE_CLASSES[slot.level]"
                    >
                      {{ trainingMasteryLabels[slot.level] }}
                    </span>
                  </div>
                </div>
              </section>

              <!-- 下一步提升建议 -->
              <section v-if="sortedRecommendations.length > 0">
                <h4 class="mb-2 text-xs font-medium text-base-content/55">
                  推荐行动（{{ sortedRecommendations.length }}）
                </h4>
                <div class="space-y-2">
                  <div
                    v-for="(rec, index) in sortedRecommendations"
                    :key="`${rec.gapCode}-${rec.actionType}-${rec.paperId ?? index}`"
                    class="flex items-center justify-between gap-3 rounded-xl bg-base-200/65 px-3.5 py-2.5 dark:bg-base-300/45"
                  >
                    <div class="min-w-0 flex-1">
                      <div class="flex flex-wrap items-center gap-1.5">
                        <p class="text-sm font-medium leading-snug text-base-content">
                          {{ rec.title }}
                        </p>
                        <span
                          v-if="rec.enhanceType"
                          class="rounded-full bg-ai/10 px-2 py-0.5 text-[11px] font-medium text-ai dark:bg-ai/15"
                        >
                          {{ aiEnhanceLabels[rec.enhanceType] }}
                        </span>
                      </div>
                      <p v-if="rec.reason" class="mt-0.5 text-xs leading-snug text-base-content/55">
                        {{ rec.reason }}
                      </p>
                    </div>
                    <button
                      v-if="
                        (rec.actionType === 'paper' && rec.paperId) ||
                        rec.actionType === 'mistakes' ||
                        rec.actionType === 'aiGenerate'
                      "
                      type="button"
                      class="flex h-8 shrink-0 items-center gap-1 rounded-lg px-2.5 text-xs font-medium transition-colors disabled:opacity-50"
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
                            ? '去练习'
                            : rec.actionType === 'mistakes'
                              ? '去错题本'
                              : generatingIndex === index
                                ? '生成中'
                                : '生成补强'
                        }}
                      </span>
                      <ArrowRight
                        v-if="rec.actionType !== 'aiGenerate'"
                        :size="13"
                        aria-hidden="true"
                      />
                    </button>
                  </div>
                </div>
              </section>

              <!-- 薄弱短板 -->
              <section v-if="activeEvaluation.diagnosis.gaps.length > 0">
                <h4 class="mb-2 flex items-center gap-1.5 text-xs font-medium text-base-content/55">
                  <AlertTriangle :size="13" class="text-warning" aria-hidden="true" />
                  主要短板（{{ activeEvaluation.diagnosis.gaps.length }}）
                </h4>
                <div class="space-y-2">
                  <div
                    v-for="(gap, index) in activeEvaluation.diagnosis.gaps"
                    :key="`${gap.code}-${index}`"
                    class="rounded-xl bg-base-200/65 px-3.5 py-2.5 dark:bg-base-300/45"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-sm font-medium text-base-content">{{ gap.title }}</span>
                      <span
                        class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        :class="severityMeta(gap.severity).badgeClass"
                      >
                        {{ severityMeta(gap.severity).label }}
                      </span>
                    </div>
                    <p class="mt-1 text-xs text-base-content/60">
                      当前：{{ gap.current }} · 目标：{{ gap.target }}
                    </p>
                    <div v-if="gap.pointKeys?.length" class="mt-1.5 flex flex-wrap gap-1">
                      <span
                        v-for="point in gap.pointKeys.slice(0, 5)"
                        :key="point"
                        class="rounded-full bg-base-100 px-2 py-0.5 text-[11px] text-base-content/65 dark:bg-base-200"
                      >
                        {{ point }}
                      </span>
                    </div>
                  </div>
                </div>
              </section>

              <!-- 优势项 -->
              <section v-if="activeEvaluation.diagnosis.strengths.length > 0">
                <h4 class="mb-2 flex items-center gap-1.5 text-xs font-medium text-base-content/55">
                  <CheckCircle2 :size="13" class="text-success" aria-hidden="true" />
                  已掌握优势（{{ activeEvaluation.diagnosis.strengths.length }}）
                </h4>
                <div class="space-y-2">
                  <div
                    v-for="(strength, index) in activeEvaluation.diagnosis.strengths"
                    :key="`${strength.code}-${index}`"
                    class="rounded-xl bg-success/10 px-3.5 py-2.5 dark:bg-success/15"
                  >
                    <p class="text-sm font-medium text-success">{{ strength.title }}</p>
                    <p class="mt-0.5 text-xs leading-snug text-base-content/70">
                      {{ strength.detail }}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </template>

          <!-- 历史评估列表 -->
          <template v-else>
            <div
              v-if="historyLoading && historyItems.length === 0"
              class="flex min-h-48 flex-col items-center justify-center gap-2 text-center"
              role="status"
            >
              <span
                class="loading loading-spinner loading-md text-primary"
                aria-hidden="true"
              ></span>
              <p class="text-xs font-medium text-base-content/55">正在加载历史评估…</p>
            </div>

            <div
              v-else-if="historyError && historyItems.length === 0"
              class="flex min-h-48 flex-col items-center justify-center gap-2.5 text-center"
              role="alert"
            >
              <p class="text-xs font-medium text-error">历史评估加载失败</p>
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
              class="flex min-h-48 flex-col items-center justify-center gap-1.5 text-center"
            >
              <p class="text-sm font-medium text-base-content">暂无历史评估</p>
              <p class="text-xs text-base-content/55">每次手动或交卷评估都会生成不可变提分快照</p>
            </div>

            <div v-else class="space-y-2">
              <button
                v-for="(item, index) in historyItems"
                :key="item.id"
                type="button"
                class="flex w-full items-center justify-between gap-3 rounded-xl px-3.5 py-3 text-left transition-colors active:bg-base-200 dark:active:bg-base-300/70"
                :class="
                  activeEvaluation?.id === item.id
                    ? 'bg-primary/10 dark:bg-primary/15'
                    : 'bg-base-200/65 dark:bg-base-300/45'
                "
                @click="selectHistoryItem(item)"
              >
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-1.5">
                    <span class="text-base font-semibold tabular-nums text-base-content">
                      {{ item.estimatedScore }} 分
                    </span>
                    <span
                      v-if="scoreDelta(index) !== null"
                      class="rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
                      :class="
                        scoreDelta(index)! > 0
                          ? 'bg-success/10 text-success'
                          : 'bg-error/10 text-error'
                      "
                    >
                      {{ scoreDelta(index)! > 0 ? `+${scoreDelta(index)}` : scoreDelta(index) }}
                    </span>
                    <span
                      class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                      :class="EVALUATION_READINESS_META[item.readinessLevel].badgeClass"
                    >
                      {{ EVALUATION_READINESS_META[item.readinessLevel].label }}
                    </span>
                  </div>
                  <p class="mt-1 truncate text-xs text-base-content/55">
                    {{ formatDateTime(item.createdAt) }} ·
                    {{ EVALUATION_TRIGGER_LABELS[item.triggerType] }} ·
                    {{ item.diagnosis.gaps.length }} 项短板
                  </p>
                </div>
                <ArrowRight :size="15" class="shrink-0 text-base-content/30" aria-hidden="true" />
              </button>

              <div v-if="hasMoreHistory" class="pt-1 text-center">
                <button
                  type="button"
                  class="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg bg-base-200/65 px-4 text-xs font-medium text-base-content/70 transition-colors active:bg-base-200 disabled:opacity-50 dark:bg-base-300/45"
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
        {{ evaluating ? '评估中…' : activeEvaluation ? '重新评估' : '立即评估' }}
      </button>
    </template>
  </BasePopup>
</template>
