<script setup lang="ts">
import { CircleAlert, Clock3 } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import PracticeResultQuestionPopup from '@/components/practice/PracticeResultQuestionPopup.vue'
import { usePracticeResult } from '@/composables/usePracticeResult'
import { RESULT_STATUS_LABELS } from '@/constants/practice'
import { questionTypeLabels } from '@/generated/domain-values'
import type { PracticeResultQuestion, PracticeResultQuestionStatus, QuestionType } from '@/types'
import { resolvePracticeReturn, returnToPracticeList } from '@/utils/browse/navigation'

const props = defineProps<{ paperId: string; submissionId: string }>()

const router = useRouter()
const route = useRoute()
const { result, loading, loadError, loadResult } = usePracticeResult({
  paperId: () => props.paperId,
  submissionId: () => props.submissionId,
  subjectName: () => (typeof route.query.subjectName === 'string' ? route.query.subjectName : ''),
})

const selectedQuestion = ref<PracticeResultQuestion | null>(null)
const resultFilter = ref<'all' | 'review'>('all')
const hasGradedQuestions = computed(() =>
  Boolean(result.value && result.value.correctCount + result.value.wrongCount > 0),
)

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

function questionStatusClasses(status: PracticeResultQuestionStatus) {
  const map = {
    correct: 'border-transparent bg-success/10 text-success',
    wrong: 'border-transparent bg-error/10 text-error',
    unanswered: 'border-base-300 bg-base-100 text-base-content/55 dark:bg-base-200',
    pending: 'border-secondary/30 bg-secondary/10 text-secondary',
  }
  return map[status]
}

function returnToPractice() {
  returnToPracticeList(router, resolvePracticeReturn(route.query, 'practice'))
}

watch(
  result,
  () => {
    selectedQuestion.value = null
    resultFilter.value = 'all'
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
        class="flex min-h-[70dvh] items-center justify-center"
        role="status"
        aria-label="正在加载练习报告"
      >
        <span class="loading loading-spinner loading-md text-primary"></span>
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
            </div>

            <div
              v-if="hasGradedQuestions"
              class="shrink-0 text-right"
              :aria-label="`客观题正确率 ${result.accuracy}%`"
            >
              <p class="text-2xl font-semibold leading-none tabular-nums text-primary">
                {{ result.accuracy }}%
              </p>
              <p class="mt-1 text-[11px] font-medium text-base-content/55">正确率</p>
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
              <span class="size-1.5 rounded-full bg-secondary"></span>待批阅
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

        <button
          class="mt-3.5 flex min-h-11 w-full items-center justify-center rounded-2xl bg-base-100 text-sm font-medium text-base-content/70 transition-colors active:bg-base-200/60 dark:bg-base-200 dark:active:bg-base-300/50"
          type="button"
          @click="returnToPractice"
        >
          返回练习
        </button>
      </template>
    </div>

    <PracticeResultQuestionPopup v-model="selectedQuestion" />
  </section>
</template>
