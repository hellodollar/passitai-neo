<script setup lang="ts">
import { ChevronRight, RefreshCw, TrendingUp } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { evaluateSubject, fetchSubjectProfile } from '@/api/subject-profile'
import SubjectEvaluationPopup from '@/components/subject-profile/SubjectEvaluationPopup.vue'
import {
  EVALUATION_READINESS_META,
  PRACTICE_RESOURCE_SLOT_FALLBACK_LABELS,
  TRAINING_MASTERY_BADGE_CLASSES,
} from '@/constants/practice'
import { practiceResourceTypes, trainingMasteryLabels } from '@/generated/practice-resource-values'
import { useAuthStore } from '@/stores/auth'
import type { GeneratedAiEnhancePaper, UserSubjectEvaluation, UserSubjectProfile } from '@/types'

const props = withDefaults(
  defineProps<{
    subjectCode: string
    subjectName?: string
    refreshKey?: number
  }>(),
  {
    subjectName: '',
    refreshKey: 0,
  },
)

const emit = defineEmits<{
  'open-paper': [paperId: string]
  'open-mistakes': []
  'ai-generated': [paper: GeneratedAiEnhancePaper]
  'profile-loaded': [profile: UserSubjectProfile | null]
}>()

const auth = useAuthStore()
const profile = ref<UserSubjectProfile | null>(null)
const loading = ref(false)
const error = ref(false)
const reloadTick = ref(0)
const evaluating = ref(false)
const evaluationPopupOpen = ref(false)
const evaluationPopupTab = ref<'detail' | 'history'>('detail')
const popupInitialEvaluation = ref<UserSubjectEvaluation | null>(null)

let evalSequence = 0

const slotSummaries = computed(() => {
  const progress = profile.value?.trainingProgress ?? {}
  return practiceResourceTypes.map((type) => {
    const slot = progress[type]
    return {
      type,
      label: PRACTICE_RESOURCE_SLOT_FALLBACK_LABELS[type],
      slot,
    }
  })
})

async function runQuickEvaluate() {
  if (!props.subjectCode || !auth.session?.token || evaluating.value) return
  const sequence = ++evalSequence
  const token = auth.session.token
  const code = props.subjectCode
  evaluating.value = true
  try {
    const evaluation = await evaluateSubject(code, { triggerType: 'manual' })
    if (sequence !== evalSequence || token !== auth.session?.token || code !== props.subjectCode) {
      return
    }
    popupInitialEvaluation.value = evaluation
    evaluationPopupTab.value = 'detail'
    evaluationPopupOpen.value = true
    reloadTick.value++
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    if (sequence === evalSequence) evaluating.value = false
  }
}

function openDiagnosis(tab: 'detail' | 'history' = 'detail') {
  popupInitialEvaluation.value = null
  evaluationPopupTab.value = tab
  evaluationPopupOpen.value = true
}

function handleEvaluated(evaluation: UserSubjectEvaluation) {
  popupInitialEvaluation.value = evaluation
  reloadTick.value++
}

function handleAiGenerated(paper: GeneratedAiEnhancePaper) {
  reloadTick.value++
  emit('ai-generated', paper)
}

watch(
  [() => props.subjectCode, () => auth.session?.token, () => props.refreshKey, reloadTick],
  async ([code, token], _, onCleanup) => {
    error.value = false
    if (!token || !code) {
      profile.value = null
      loading.value = false
      emit('profile-loaded', null)
      return
    }
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    // 切换科目时清空旧画像；同科目静默刷新时保留卡片避免闪烁
    if (profile.value?.subjectCode !== code) {
      profile.value = null
      loading.value = true
      emit('profile-loaded', null)
    }
    try {
      const result = await fetchSubjectProfile(code, controller.signal)
      if (controller.signal.aborted) return
      profile.value = result
      emit('profile-loaded', result)
    } catch {
      if (!controller.signal.aborted) {
        error.value = true
        if (!profile.value) emit('profile-loaded', null)
      }
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)

watch(
  () => auth.session?.token,
  () => {
    evalSequence++
    evaluating.value = false
    evaluationPopupOpen.value = false
    popupInitialEvaluation.value = null
  },
)

onBeforeUnmount(() => {
  evalSequence++
})
</script>

<template>
  <section
    aria-label="科目画像与估分"
    class="overflow-hidden rounded-2xl bg-base-100 dark:bg-base-200"
  >
    <div v-if="loading && !profile" role="status" aria-label="正在加载科目画像…" class="p-3.5">
      <div class="flex items-center justify-between gap-3">
        <div class="space-y-1.5">
          <span class="block h-5 w-24 animate-pulse rounded bg-base-200 dark:bg-base-300/70"></span>
          <span
            class="block h-3 w-36 animate-pulse rounded bg-base-200/80 dark:bg-base-300/60"
          ></span>
        </div>
        <span class="h-8 w-20 animate-pulse rounded-lg bg-base-200 dark:bg-base-300/70"></span>
      </div>
      <div class="mt-3 grid grid-cols-4 gap-2">
        <span
          v-for="index in 4"
          :key="index"
          class="h-14 animate-pulse rounded-xl bg-base-200/65 dark:bg-base-300/45"
        ></span>
      </div>
    </div>

    <div
      v-else-if="error && !profile"
      role="alert"
      class="flex items-center justify-between gap-3 px-4 py-3.5"
    >
      <p class="text-xs font-medium text-error">科目画像加载失败</p>
      <button
        type="button"
        class="rounded-lg bg-error/10 px-3 py-1 text-xs font-medium text-error transition-colors active:bg-error/15"
        @click="reloadTick++"
      >
        重试
      </button>
    </div>

    <template v-else-if="profile">
      <div class="p-3.5">
        <div class="flex items-start justify-between gap-3">
          <div class="min-w-0">
            <div v-if="profile.latestEvaluation" class="flex flex-wrap items-baseline gap-1.5">
              <span class="text-2xl font-semibold leading-none tabular-nums text-primary">
                {{ profile.latestEvaluation.estimatedScore }}
              </span>
              <span class="text-xs font-medium text-base-content/55">分</span>
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="
                  EVALUATION_READINESS_META[profile.latestEvaluation.readinessLevel].badgeClass
                "
              >
                {{ EVALUATION_READINESS_META[profile.latestEvaluation.readinessLevel].label }}
              </span>
              <span
                class="rounded-full px-2 py-0.5 text-[11px] font-medium"
                :class="TRAINING_MASTERY_BADGE_CLASSES[profile.latestEvaluation.masteryLevel]"
              >
                {{ trainingMasteryLabels[profile.latestEvaluation.masteryLevel] }}
              </span>
            </div>
            <div v-else class="flex items-center gap-1.5">
              <TrendingUp :size="16" class="shrink-0 text-primary" aria-hidden="true" />
              <span class="text-sm font-semibold text-base-content">PassIt 画像</span>
              <span
                class="rounded-full bg-base-200/80 px-2 py-0.5 text-[11px] font-medium text-base-content/55 dark:bg-base-300/50"
              >
                暂未评估
              </span>
            </div>

            <p class="mt-1.5 truncate text-xs leading-snug text-base-content/55 tabular-nums">
              已练 {{ profile.practiceCount }} 次 · 作答 {{ profile.answeredQuestions }} 题 ·
              待清错题 {{ profile.unresolvedMistakes }} 题
            </p>
          </div>

          <button
            type="button"
            class="flex h-8 shrink-0 items-center gap-1 rounded-lg bg-primary/10 px-2.5 text-xs font-medium text-primary transition-colors active:bg-primary/15 disabled:opacity-50 dark:bg-primary/15"
            :disabled="evaluating"
            @click="runQuickEvaluate"
          >
            <span
              v-if="evaluating"
              class="loading loading-spinner loading-xs"
              aria-hidden="true"
            ></span>
            <RefreshCw v-else :size="13" aria-hidden="true" />
            <span>{{ evaluating ? '评估中' : '立即评估' }}</span>
          </button>
        </div>

        <div class="mt-3 grid grid-cols-4 gap-1.5">
          <div
            v-for="item in slotSummaries"
            :key="item.type"
            class="rounded-xl bg-base-200/65 px-1.5 py-2 text-center dark:bg-base-300/45"
          >
            <p class="truncate text-[11px] font-medium text-base-content/55">{{ item.label }}</p>
            <p class="mt-1 text-sm font-semibold leading-tight tabular-nums text-base-content">
              {{ item.slot ? item.slot.score : '—' }}
            </p>
            <span
              v-if="item.slot"
              class="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[11px] font-medium leading-none"
              :class="TRAINING_MASTERY_BADGE_CLASSES[item.slot.level]"
            >
              {{ trainingMasteryLabels[item.slot.level] }}
            </span>
            <span v-else class="mt-1 inline-block text-[11px] leading-none text-base-content/40">
              未开始
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="flex w-full items-center justify-between gap-2 border-t border-base-content/[0.06] px-3.5 py-2.5 text-left transition-colors active:bg-base-200/60 dark:border-base-content/[0.08] dark:active:bg-base-300/50"
        @click="openDiagnosis(profile.latestEvaluation ? 'detail' : 'history')"
      >
        <span class="min-w-0 flex-1 truncate text-xs text-base-content/65">
          {{
            profile.latestEvaluation?.summary ||
            (profile.latestEvaluation
              ? `当前有 ${profile.latestEvaluation.gapCount} 项短板、${profile.latestEvaluation.recommendationCount} 条提升建议`
              : '查看规则诊断建议与历史提分记录')
          }}
        </span>
        <span class="flex shrink-0 items-center gap-0.5 text-xs font-medium text-primary">
          诊断与历史
          <ChevronRight :size="14" aria-hidden="true" />
        </span>
      </button>
    </template>

    <SubjectEvaluationPopup
      v-model="evaluationPopupOpen"
      :subject-code="subjectCode"
      :subject-name="subjectName || profile?.subjectName"
      :initial-evaluation="popupInitialEvaluation"
      :initial-tab="evaluationPopupTab"
      @open-paper="emit('open-paper', $event)"
      @open-mistakes="emit('open-mistakes')"
      @ai-generated="handleAiGenerated"
      @evaluated="handleEvaluated"
    />
  </section>
</template>
