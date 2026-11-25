<script setup lang="ts">
import { CircleAlert, ClipboardCheck, Clock3, TrendingUp } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { evaluateSubject } from '@/api/subject-profile'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PracticeResultQuestionPopup from '@/components/practice/PracticeResultQuestionPopup.vue'
import SubjectEvaluationPopup from '@/components/subject-profile/SubjectEvaluationPopup.vue'
import { usePracticeResult } from '@/composables/usePracticeResult'
import { RESULT_STATUS_LABELS, SUBJECTIVE_SELF_GRADE_OPTIONS } from '@/constants/practice'
import { questionTypeLabels } from '@/generated/domain-values'
import { useAuthStore } from '@/stores/auth'
import type {
  PracticeResultQuestion,
  PracticeResultQuestionStatus,
  QuestionType,
  SubjectiveSelfGradeRating,
  UserSubjectEvaluation,
} from '@/types'
import { resolvePracticeReturn, returnToPracticeList } from '@/utils/browse/navigation'
import { isChoiceQuestionType } from '@/utils/practice/question'
import { estimateSubjectiveSelfGrade } from '@/utils/practice/result'
import { showSuccessToast } from '@/utils/toast'

const props = defineProps<{ paperId: string; submissionId: string }>()

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const {
  result,
  loading,
  loadError,
  submittingSelfGrade,
  selfGradeError,
  loadResult,
  submitSelfGrade,
} = usePracticeResult({
  paperId: () => props.paperId,
  submissionId: () => props.submissionId,
  subjectName: () => (typeof route.query.subjectName === 'string' ? route.query.subjectName : ''),
})

const selectedQuestion = ref<PracticeResultQuestion | null>(null)
const resultFilter = ref<'all' | 'review'>('all')
const selfGradeRatings = ref<Record<string, SubjectiveSelfGradeRating>>({})
const evaluationPopupOpen = ref(false)
const latestEvaluation = ref<UserSubjectEvaluation | null>(null)
const evaluatingSubject = ref(false)

const hasGradedQuestions = computed(() =>
  Boolean(result.value && result.value.correctCount + result.value.wrongCount > 0),
)

/** 本次交卷已作答的主观题，可提交三档自评 */
const answeredSubjectiveQuestions = computed(() =>
  (result.value?.questions ?? []).filter(
    (question) => !isChoiceQuestionType(question.questionType) && Boolean(question.userAnswer),
  ),
)

const ratedSubjectiveCount = computed(
  () =>
    answeredSubjectiveQuestions.value.filter((question) =>
      Boolean(selfGradeRatings.value[question.id]),
    ).length,
)

const selectiveSubjectiveNotices = computed(() => {
  const sections = result.value?.sections ?? []
  const questionById = new Map((result.value?.questions ?? []).map((q) => [q.id, q]))
  return sections.flatMap((section) => {
    if (
      typeof section.answerCount !== 'number' ||
      section.answerCount <= 0 ||
      section.answerCount >= section.questionIds.length
    ) {
      return []
    }
    const hasSubjective = section.questionIds.some((id) => {
      const q = questionById.get(id)
      return q && !isChoiceQuestionType(q.questionType)
    })
    if (!hasSubjective) return []
    const scoreNote =
      typeof section.perScore === 'number' && section.perScore > 0
        ? `，满分 ${Math.round(section.answerCount * section.perScore * 100) / 100} 分`
        : ''
    return [
      `「${section.name}」任选 ${section.answerCount} 题作答（共 ${section.questionIds.length} 题，按最高 ${section.answerCount} 题封顶计分${scoreNote}）`,
    ]
  })
})

const subjectiveScorePreview = computed(() => {
  if (!result.value || ratedSubjectiveCount.value === 0) return null
  return estimateSubjectiveSelfGrade(result.value, selfGradeRatings.value)
})

const filteredQuestions = computed(() => {
  const questions = result.value?.questions ?? []
  if (resultFilter.value === 'all') return questions
  return questions.filter((question) => question.status !== 'correct')
})

const questionGroups = computed(() => {
  const groups = new Map<QuestionType, PracticeResultQuestion[]>()
  for (const question of filteredQuestions.value) {
    const questions = groups.get(question.questionType) ?? []
    questions.push(question)
    groups.set(question.questionType, questions)
  }
  return [...groups.entries()]
})

const elapsedText = computed(() => {
  const seconds = result.value?.elapsedSeconds
  if (typeof seconds !== 'number') return ''
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return minutes > 0 ? `${minutes}分${restSeconds}秒` : `${restSeconds}秒`
})

const scoreHeadline = computed(() => {
  const current = result.value
  if (!current) return null
  if (current.score !== null) {
    return { value: `${current.score}`, unit: '分', label: '综合得分' }
  }
  if (current.objectiveScore !== null) {
    return { value: `${current.objectiveScore}`, unit: '分', label: '客观题得分' }
  }
  if (hasGradedQuestions.value) {
    return { value: `${current.accuracy}`, unit: '%', label: '客观正确率' }
  }
  return null
})

function questionStatusClasses(status: PracticeResultQuestionStatus) {
  const map: Record<PracticeResultQuestionStatus, string> = {
    correct: 'border-transparent bg-success/10 text-success',
    wrong: 'border-transparent bg-error/10 text-error',
    unanswered: 'border-base-300 bg-base-100 text-base-content/55 dark:bg-base-200',
    pending: 'border-secondary/30 bg-secondary/10 text-secondary',
    graded: 'border-primary/25 bg-primary/10 text-primary',
  }
  return map[status]
}

function setRating(questionId: string, rating: SubjectiveSelfGradeRating) {
  selfGradeRatings.value = { ...selfGradeRatings.value, [questionId]: rating }
}

async function handleSubmitSelfGrade() {
  const ratings: Record<string, SubjectiveSelfGradeRating> = {}
  for (const question of answeredSubjectiveQuestions.value) {
    const value = selfGradeRatings.value[question.id]
    if (value) ratings[question.id] = value
  }
  if (Object.keys(ratings).length === 0) return
  const ok = await submitSelfGrade(ratings)
  if (ok) showSuccessToast('主观题自评已提交，得分与科目画像已更新')
}

async function evaluateAfterPractice() {
  const subjectCode = result.value?.subjectCode
  if (!subjectCode || evaluatingSubject.value) return
  const token = auth.session?.token
  const submissionId = props.submissionId
  evaluatingSubject.value = true
  try {
    const evaluation = await evaluateSubject(subjectCode, { triggerType: 'practice' })
    if (token !== auth.session?.token || submissionId !== props.submissionId) return
    latestEvaluation.value = evaluation
    evaluationPopupOpen.value = true
  } catch {
    // 错误提示由请求层统一展示
  } finally {
    evaluatingSubject.value = false
  }
}

function openRecommendedPaper(paperId: string) {
  const returnTo = resolvePracticeReturn(route.query, 'practice')
  void router.push({
    name: 'practice',
    params: { paperId },
    query: {
      subjectName: result.value?.subjectName || undefined,
      returnTo,
    },
  })
}

function returnToPractice() {
  returnToPracticeList(router, resolvePracticeReturn(route.query, 'practice'))
}

watch(
  [() => props.paperId, () => props.submissionId],
  () => {
    selectedQuestion.value = null
    resultFilter.value = 'all'
    selfGradeRatings.value = {}
    evaluationPopupOpen.value = false
    latestEvaluation.value = null
  },
  { flush: 'sync' },
)
</script>

<template>
  <section
    class="min-h-dvh bg-base-200/80 pb-[calc(2rem+env(safe-area-inset-bottom))] dark:bg-base-100"
  >
    <PageHeader title="练习报告" back-label="返回练习" @back="returnToPractice" />

    <div class="px-4 pt-[calc(3.875rem+env(safe-area-inset-top))]">
      <div
        v-if="loading"
        class="flex min-h-[70dvh] flex-col items-center justify-center gap-2.5 text-center"
        role="status"
        aria-live="polite"
      >
        <span class="loading loading-spinner loading-md text-primary" aria-hidden="true"></span>
        <p class="text-xs font-medium text-base-content/55">正在加载…</p>
      </div>

      <div v-else-if="loadError || !result" class="flex min-h-[70dvh] items-center justify-center">
        <div class="w-full rounded-2xl bg-base-100 dark:bg-base-200">
          <EmptyState
            :icon="CircleAlert"
            tone="error"
            title="加载失败"
            description="请稍后重试"
            action-label="重试"
            embedded
            @action="loadResult"
          />
        </div>
      </div>

      <template v-else>
        <section class="overflow-hidden rounded-2xl bg-base-100 dark:bg-base-200">
          <div class="flex min-w-0 items-start justify-between gap-3 px-4 pb-3.5 pt-4">
            <div class="min-w-0">
              <h2 class="truncate text-base font-semibold leading-snug tracking-tight">
                {{ result.paperName }}
              </h2>
              <p
                v-if="result.subjectName"
                class="mt-1 truncate text-xs leading-snug text-base-content/55"
              >
                {{ result.subjectName }}
              </p>
              <p
                v-if="result.objectiveScore !== null || result.subjectiveScore !== null"
                class="mt-1.5 text-xs tabular-nums text-base-content/55"
              >
                <template v-if="result.objectiveScore !== null">
                  客观 {{ result.objectiveScore }} 分
                </template>
                <template v-if="result.objectiveScore !== null && result.subjectiveScore !== null">
                  ·
                </template>
                <template v-if="result.subjectiveScore !== null">
                  主观 {{ result.subjectiveScore }} 分
                </template>
              </p>
            </div>

            <div
              v-if="scoreHeadline"
              class="shrink-0 text-right"
              :aria-label="`${scoreHeadline.label} ${scoreHeadline.value}${scoreHeadline.unit}`"
            >
              <p class="text-2xl font-semibold leading-none tabular-nums text-primary">
                {{ scoreHeadline.value
                }}<span class="ml-0.5 text-xs font-medium text-primary/80">{{
                  scoreHeadline.unit
                }}</span>
              </p>
              <p class="mt-1 text-[11px] font-medium text-base-content/55">
                {{ scoreHeadline.label }}
              </p>
            </div>
          </div>

          <dl
            class="grid grid-cols-4 divide-x divide-base-content/[0.06] border-t border-base-content/[0.06] dark:divide-base-content/[0.08] dark:border-base-content/[0.08]"
          >
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] font-medium text-base-content/55">总题数</dt>
              <dd class="mt-1 text-base font-semibold tabular-nums text-base-content">
                {{ result.totalCount }}
              </dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] font-medium text-base-content/55">正确</dt>
              <dd class="mt-1 text-base font-semibold tabular-nums text-success">
                {{ result.correctCount }}
              </dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] font-medium text-base-content/55">错误</dt>
              <dd class="mt-1 text-base font-semibold tabular-nums text-error">
                {{ result.wrongCount }}
              </dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] font-medium text-base-content/55">未答</dt>
              <dd class="mt-1 text-base font-semibold tabular-nums text-base-content/70">
                {{ result.unansweredCount }}
              </dd>
            </div>
          </dl>

          <div
            v-if="elapsedText"
            class="flex items-center justify-center gap-1.5 border-t border-base-content/[0.06] py-2.5 text-xs text-base-content/55 dark:border-base-content/[0.08]"
          >
            <Clock3 :size="14" />
            本次用时 {{ elapsedText }}
          </div>
        </section>

        <!-- 主观题三档自评 -->
        <section
          v-if="answeredSubjectiveQuestions.length > 0"
          class="mt-3.5 overflow-hidden rounded-2xl bg-base-100 p-4 dark:bg-base-200"
        >
          <div class="flex items-center justify-between gap-2">
            <div>
              <h2
                class="flex items-center gap-1.5 text-[15px] font-semibold leading-tight tracking-tight"
              >
                <ClipboardCheck :size="16" class="text-secondary" aria-hidden="true" />
                主观题自评
              </h2>
              <p class="mt-0.5 text-xs leading-snug text-base-content/55">
                对照参考答案评分，提交后自动计算总分并更新科目画像
              </p>
            </div>
            <span class="shrink-0 text-xs font-medium tabular-nums text-base-content/55">
              {{ ratedSubjectiveCount }}/{{ answeredSubjectiveQuestions.length }}
            </span>
          </div>

          <ul
            v-if="selectiveSubjectiveNotices.length > 0"
            class="mt-2.5 space-y-1 rounded-xl bg-info/10 px-3 py-2 text-xs leading-snug text-info dark:bg-info/15"
          >
            <li v-for="notice in selectiveSubjectiveNotices" :key="notice">{{ notice }}</li>
          </ul>

          <div class="mt-3 space-y-3">
            <article
              v-for="question in answeredSubjectiveQuestions"
              :key="question.id"
              class="rounded-xl bg-base-200/65 p-3 dark:bg-base-300/45"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-medium text-base-content/55">
                  第 {{ question.index }} 题 · {{ questionTypeLabels[question.questionType] }}
                </span>
                <button
                  type="button"
                  class="text-xs font-medium text-primary active:opacity-75"
                  @click="selectedQuestion = question"
                >
                  看解析
                </button>
              </div>
              <p class="mt-1.5 line-clamp-2 text-sm font-medium leading-snug text-base-content">
                {{ question.title }}
              </p>
              <div
                class="mt-2 space-y-1 rounded-lg bg-base-100/80 px-2.5 py-2 text-xs leading-relaxed dark:bg-base-200/80"
              >
                <p class="text-base-content/75">
                  <span class="font-medium text-base-content/55">我的答案：</span
                  >{{ question.userAnswer }}
                </p>
                <p class="text-success">
                  <span class="font-medium text-base-content/55">参考答案：</span
                  >{{ question.correctAnswer || '暂无参考答案' }}
                </p>
              </div>
              <div
                class="mt-2.5 grid grid-cols-3 gap-1.5"
                role="radiogroup"
                :aria-label="`第 ${question.index} 题自评`"
              >
                <button
                  v-for="option in SUBJECTIVE_SELF_GRADE_OPTIONS"
                  :key="option.value"
                  type="button"
                  role="radio"
                  :aria-checked="selfGradeRatings[question.id] === option.value"
                  class="flex h-8 items-center justify-center gap-1 rounded-lg border text-xs transition-colors"
                  :class="
                    selfGradeRatings[question.id] === option.value
                      ? option.activeClass
                      : 'border-transparent bg-base-100 font-medium text-base-content/70 active:bg-base-200 dark:bg-base-200'
                  "
                  @click="setRating(question.id, option.value)"
                >
                  <span>{{ option.label }}</span>
                  <span class="text-[11px] opacity-70">{{ option.ratio }}</span>
                </button>
              </div>
            </article>
          </div>

          <p
            v-if="subjectiveScorePreview"
            class="mt-2.5 flex items-center justify-between text-xs tabular-nums text-base-content/65"
          >
            <span>预计主观得分 {{ subjectiveScorePreview.subjectiveScore }} 分</span>
            <span
              v-if="subjectiveScorePreview.totalScore !== null"
              class="font-medium text-primary"
            >
              预计总分 {{ subjectiveScorePreview.totalScore }} 分
            </span>
          </p>

          <p v-if="selfGradeError" role="alert" class="mt-2.5 text-xs text-error">
            {{ selfGradeError }}
          </p>

          <button
            type="button"
            class="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-content transition-colors active:opacity-90 disabled:opacity-50"
            :disabled="submittingSelfGrade || ratedSubjectiveCount === 0"
            @click="handleSubmitSelfGrade"
          >
            <span
              v-if="submittingSelfGrade"
              class="loading loading-spinner loading-xs"
              aria-hidden="true"
            ></span>
            {{
              submittingSelfGrade
                ? '提交中…'
                : result.subjectiveScore !== null
                  ? '更新主观题自评'
                  : '提交主观题自评'
            }}
          </button>
        </section>

        <section class="mt-3.5 overflow-hidden rounded-2xl bg-base-100 dark:bg-base-200">
          <div class="flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <h2 class="text-[15px] font-semibold leading-tight tracking-tight">作答明细</h2>
              <p class="mt-0.5 text-xs leading-snug text-base-content/55">点击题号查看答案与解析</p>
            </div>
            <div
              class="flex shrink-0 rounded-xl bg-base-200/65 p-1 text-xs dark:bg-base-300/45"
              role="group"
              aria-label="作答筛选"
            >
              <button
                class="whitespace-nowrap rounded-lg px-2.5 py-1 transition-colors"
                :class="
                  resultFilter === 'all'
                    ? 'bg-primary/12 font-semibold text-primary dark:bg-primary/18'
                    : 'font-medium text-base-content/70'
                "
                type="button"
                :aria-pressed="resultFilter === 'all'"
                @click="resultFilter = 'all'"
              >
                全部
              </button>
              <button
                class="whitespace-nowrap rounded-lg px-2.5 py-1 transition-colors"
                :class="
                  resultFilter === 'review'
                    ? 'bg-error/12 font-semibold text-error dark:bg-error/18'
                    : 'font-medium text-base-content/70'
                "
                type="button"
                :aria-pressed="resultFilter === 'review'"
                @click="resultFilter = 'review'"
              >
                需复习
              </button>
            </div>
          </div>

          <div
            class="flex flex-wrap gap-x-4 gap-y-1 border-y border-base-content/[0.06] px-4 py-2 text-[11px] font-medium dark:border-base-content/[0.08]"
          >
            <span class="flex items-center gap-1.5 text-base-content/55">
              <span class="size-1.5 rounded-full bg-success"></span>正确
            </span>
            <span class="flex items-center gap-1.5 text-base-content/55">
              <span class="size-1.5 rounded-full bg-error"></span>错误
            </span>
            <span class="flex items-center gap-1.5 text-base-content/55">
              <span class="size-1.5 rounded-full border border-base-300 bg-base-100"></span>未答
            </span>
            <span class="flex items-center gap-1.5 text-base-content/55">
              <span class="size-1.5 rounded-full bg-secondary"></span>待自评
            </span>
            <span
              v-if="result.subjectiveScore !== null"
              class="flex items-center gap-1.5 text-base-content/55"
            >
              <span class="size-1.5 rounded-full bg-primary"></span>已自评
            </span>
          </div>

          <div v-if="questionGroups.length > 0" class="grid gap-4 p-4">
            <div v-for="[type, questions] in questionGroups" :key="type">
              <p class="mb-2 text-xs font-medium text-base-content/55">
                {{ questionTypeLabels[type] }}（{{ questions.length }}题）
              </p>
              <div
                class="grid grid-cols-[repeat(auto-fill,minmax(1.75rem,1fr))] justify-items-center gap-x-1 gap-y-1.5"
              >
                <button
                  v-for="question in questions"
                  :key="question.id"
                  class="flex size-7 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors active:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  :class="questionStatusClasses(question.status)"
                  type="button"
                  :aria-label="`第 ${question.index} 题，${RESULT_STATUS_LABELS[question.status]}`"
                  @click="selectedQuestion = question"
                >
                  {{ question.index }}
                </button>
              </div>
            </div>
          </div>

          <div v-else class="px-4 py-10 text-center text-xs text-base-content/55">
            当前没有需要复习的题目
          </div>
        </section>

        <div class="mt-3.5 grid grid-cols-2 gap-2.5">
          <button
            class="flex min-h-11 items-center justify-center rounded-2xl bg-base-100 text-sm font-medium text-base-content/70 transition-colors active:bg-base-200/60 dark:bg-base-200 dark:active:bg-base-300/50"
            type="button"
            @click="returnToPractice"
          >
            返回练习
          </button>
          <button
            v-if="result.subjectCode"
            class="flex min-h-11 items-center justify-center gap-1.5 rounded-2xl bg-primary text-sm font-medium text-primary-content transition-colors active:opacity-90 disabled:opacity-50"
            type="button"
            :disabled="evaluatingSubject"
            @click="evaluateAfterPractice"
          >
            <span
              v-if="evaluatingSubject"
              class="loading loading-spinner loading-xs"
              aria-hidden="true"
            ></span>
            <TrendingUp v-else :size="15" aria-hidden="true" />
            {{ evaluatingSubject ? '评估中…' : '立即评估科目' }}
          </button>
        </div>
      </template>
    </div>

    <PracticeResultQuestionPopup v-model="selectedQuestion" />
    <SubjectEvaluationPopup
      v-if="result?.subjectCode"
      v-model="evaluationPopupOpen"
      :subject-code="result.subjectCode"
      :subject-name="result.subjectName"
      :initial-evaluation="latestEvaluation"
      @open-paper="openRecommendedPaper"
      @open-mistakes="router.push({ name: 'mistakes' })"
    />
  </section>
</template>
