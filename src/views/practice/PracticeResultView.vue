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
    correct: 'border-success bg-success text-success-content',
    wrong: 'border-error bg-error text-error-content',
    unanswered: 'border-base-300 bg-base-100 text-base-content/65',
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
  <section class="min-h-dvh bg-base-200/35 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <PageHeader title="练习报告" back-label="返回练习" @back="returnToPractice" />

    <div class="px-5 pt-[calc(4.5rem+env(safe-area-inset-top))]">
      <div
        v-if="loading"
        class="flex min-h-[70dvh] items-center justify-center"
        role="status"
        aria-label="正在加载练习报告"
      >
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div v-else-if="loadError || !result" class="flex min-h-[70dvh] items-center justify-center">
        <EmptyState
          :icon="CircleAlert"
          tone="error"
          title="报告加载失败"
          description="暂时无法获取本次作答结果。"
          action-label="重新加载"
          embedded
          @action="loadResult"
        />
      </div>

      <template v-else>
        <section class="overflow-hidden rounded-2xl border border-base-200 bg-base-100">
          <div class="flex min-w-0 items-start justify-between gap-3 px-4 pb-3.5 pt-4">
            <div class="min-w-0">
              <h2 class="truncate text-lg font-semibold leading-tight">{{ result.paperName }}</h2>
              <p
                v-if="result.subjectName"
                class="mt-1 truncate text-xs font-medium text-base-content/65"
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
              <p class="mt-1 text-[11px] font-medium text-base-content/65">正确率</p>
            </div>
          </div>

          <dl class="grid grid-cols-4 divide-x divide-base-200 border-t border-base-200">
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/65">总题数</dt>
              <dd class="mt-1 text-base font-semibold tabular-nums">{{ result.totalCount }}</dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/65">正确</dt>
              <dd class="mt-1 text-base font-semibold text-success tabular-nums">
                {{ result.correctCount }}
              </dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/65">错误</dt>
              <dd class="mt-1 text-base font-semibold text-error tabular-nums">
                {{ result.wrongCount }}
              </dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/65">未答</dt>
              <dd class="mt-1 text-base font-semibold text-base-content/75 tabular-nums">
                {{ result.unansweredCount }}
              </dd>
            </div>
          </dl>

          <div
            v-if="elapsedText"
            class="flex items-center justify-center gap-1.5 border-t border-base-200 py-2.5 text-xs text-base-content/65"
          >
            <Clock3 :size="14" />
            本次用时 {{ elapsedText }}
          </div>
        </section>

        <section class="mt-4 overflow-hidden rounded-2xl border border-base-200 bg-base-100">
          <div class="flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <h2 class="text-base font-semibold">作答明细</h2>
              <p class="mt-0.5 text-xs text-base-content/65">点击题号查看答案与解析</p>
            </div>
            <div
              class="flex shrink-0 rounded-lg bg-base-200/70 p-0.5 text-xs"
              role="group"
              aria-label="作答筛选"
            >
              <button
                class="whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition"
                :class="
                  resultFilter === 'all' ? 'bg-base-100 text-primary' : 'text-base-content/65'
                "
                type="button"
                :aria-pressed="resultFilter === 'all'"
                @click="resultFilter = 'all'"
              >
                全部
              </button>
              <button
                class="whitespace-nowrap rounded-md px-2.5 py-1.5 font-medium transition"
                :class="
                  resultFilter === 'review' ? 'bg-base-100 text-error' : 'text-base-content/65'
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
            class="flex flex-wrap gap-x-4 gap-y-1 border-y border-base-200 px-4 py-2 text-[11px]"
          >
            <span class="flex items-center gap-1.5 text-base-content/65">
              <span class="size-2 rounded-full bg-success"></span>正确
            </span>
            <span class="flex items-center gap-1.5 text-base-content/65">
              <span class="size-2 rounded-full bg-error"></span>错误
            </span>
            <span class="flex items-center gap-1.5 text-base-content/65">
              <span class="size-2 rounded-full border border-base-300 bg-base-100"></span>未答
            </span>
            <span class="flex items-center gap-1.5 text-base-content/65">
              <span class="size-2 rounded-full bg-secondary"></span>待批阅
            </span>
          </div>

          <div v-if="questionGroups.length > 0" class="grid gap-4 p-4">
            <div v-for="[type, questions] in questionGroups" :key="type">
              <p class="mb-2 text-xs font-medium text-base-content/65">
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

          <div v-else class="px-5 py-10 text-center text-sm text-base-content/65">
            当前没有需要复习的题目
          </div>
        </section>

        <button
          class="btn mt-4 h-11 min-h-11 w-full rounded-xl border-base-200 bg-base-100 text-sm"
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
