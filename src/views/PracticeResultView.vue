<script setup lang="ts">
import { ArrowLeft, CircleAlert, Clock3 } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchPracticePaper, fetchPracticeSubmission } from '@/api/practice'
import BaseModal from '@/components/common/BaseModal.vue'
import { practiceReturnTarget, returnFromPractice } from '@/utils/browse-state'
import { QUESTION_TYPE_LABELS } from '@/constants/entity'
import { usePracticeStore } from '@/stores/practice'
import { buildSubmissionResult } from '@/utils/practice-result'
import type {
  PracticeResultQuestion,
  PracticeResultQuestionStatus,
  PracticeSubmissionResult,
  QuestionType,
} from '@/types'

const router = useRouter()
const route = useRoute()
const practice = usePracticeStore()

const result = ref<PracticeSubmissionResult | null>(null)
const loading = ref(true)
const loadError = ref(false)
const detailOpen = ref(false)
const selectedQuestion = ref<PracticeResultQuestion | null>(null)
const resultFilter = ref<'all' | 'review'>('all')
let loadRequestId = 0
const hasGradedQuestions = computed(() =>
  Boolean(result.value && result.value.correctCount + result.value.wrongCount > 0),
)
const submissionId = computed(() =>
  typeof route.query.submissionId === 'string' ? route.query.submissionId : '',
)
const paperId = computed(() =>
  typeof route.params.paperId === 'string' ? route.params.paperId : '',
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

async function loadResult() {
  const requestId = ++loadRequestId
  loading.value = true
  loadError.value = false
  result.value = null
  if (!paperId.value || !submissionId.value) {
    loadError.value = true
    loading.value = false
    return
  }

  try {
    const [detail, submission] = await Promise.all([
      fetchPracticePaper(paperId.value),
      fetchPracticeSubmission(paperId.value, submissionId.value),
    ])
    if (requestId !== loadRequestId) return
    result.value = buildSubmissionResult(
      detail,
      submission,
      paperId.value,
      typeof route.query.subject === 'string' ? route.query.subject : '',
    )
  } catch {
    if (requestId !== loadRequestId) return
    loadError.value = true
  } finally {
    if (requestId === loadRequestId) loading.value = false
  }
}

function questionStatusClasses(status: PracticeResultQuestionStatus) {
  const map = {
    correct: 'border-success bg-success text-white',
    wrong: 'border-error bg-error text-white',
    unanswered: 'border-base-300 bg-base-100 text-base-content/45',
    pending: 'border-warning/30 bg-warning/10 text-warning',
  }
  return map[status]
}

function statusLabel(status: PracticeResultQuestionStatus) {
  const map = {
    correct: '回答正确',
    wrong: '回答错误',
    unanswered: '未作答',
    pending: '待批阅',
  }
  return map[status]
}

function openQuestion(question: PracticeResultQuestion) {
  selectedQuestion.value = question
  detailOpen.value = true
}

function returnToPractice() {
  returnFromPractice(router, practiceReturnTarget(route.query, false))
}

onMounted(() => {
  practice.startPractice()
})

watch(
  [paperId, submissionId],
  () => {
    void loadResult()
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  practice.endPractice()
})
</script>

<template>
  <section class="-mx-5 min-h-dvh bg-base-200/35 pb-[calc(2rem+env(safe-area-inset-bottom))]">
    <header
      class="fixed left-1/2 top-0 z-40 w-full max-w-[32rem] -translate-x-1/2 border-b border-base-200/80 bg-base-100/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl"
    >
      <div class="grid h-14 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3">
        <button
          class="flex size-10 items-center justify-center rounded-full transition active:bg-base-200"
          type="button"
          aria-label="返回练习"
          @click="returnToPractice"
        >
          <ArrowLeft :size="21" />
        </button>
        <h1 class="truncate text-center text-[15px] font-semibold">练习报告</h1>
        <span aria-hidden="true"></span>
      </div>
    </header>

    <main class="px-5 pt-[calc(4.5rem+env(safe-area-inset-top))]">
      <div v-if="loading" class="flex min-h-[70dvh] items-center justify-center">
        <span class="loading loading-spinner loading-md text-primary"></span>
      </div>

      <div v-else-if="loadError || !result" class="flex min-h-[70dvh] items-center justify-center">
        <div class="max-w-xs text-center">
          <span
            class="mx-auto flex size-14 items-center justify-center rounded-2xl bg-error/10 text-error"
          >
            <CircleAlert :size="27" />
          </span>
          <h2 class="mt-4 text-lg font-semibold">报告加载失败</h2>
          <p class="mt-2 text-sm leading-6 text-base-content/65">暂时无法获取本次作答结果。</p>
          <button
            class="btn btn-primary mt-5 h-10 min-h-10 rounded-xl px-6 text-sm"
            type="button"
            @click="loadResult"
          >
            重新加载
          </button>
        </div>
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
            <div class="flex rounded-lg bg-base-200/70 p-0.5 text-xs">
              <button
                class="rounded-md px-2.5 py-1.5 font-medium transition"
                :class="
                  resultFilter === 'all' ? 'bg-base-100 text-primary' : 'text-base-content/65'
                "
                type="button"
                @click="resultFilter = 'all'"
              >
                全部
              </button>
              <button
                class="rounded-md px-2.5 py-1.5 font-medium transition"
                :class="
                  resultFilter === 'review' ? 'bg-base-100 text-error' : 'text-base-content/65'
                "
                type="button"
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
              <span class="size-2 rounded-full bg-warning/60"></span>待批阅
            </span>
          </div>

          <div v-if="questionGroups.length > 0" class="grid gap-4 p-4">
            <div v-for="[type, questions] in questionGroups" :key="type">
              <p class="mb-2 text-xs font-medium text-base-content/65">
                {{ QUESTION_TYPE_LABELS[type] }}（{{ questions.length }}题）
              </p>
              <div class="grid grid-cols-7 justify-items-center gap-2 sm:grid-cols-10">
                <button
                  v-for="question in questions"
                  :key="question.id"
                  class="flex size-9 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition active:scale-90"
                  :class="questionStatusClasses(question.status)"
                  type="button"
                  :aria-label="`第 ${question.index} 题，${statusLabel(question.status)}`"
                  @click="openQuestion(question)"
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
    </main>

    <BaseModal v-model="detailOpen" title="题目详情">
      <template v-if="selectedQuestion">
        <div class="flex items-center justify-between gap-3">
          <span class="text-xs font-medium text-base-content/65">
            第 {{ selectedQuestion.index }} 题 ·
            {{ QUESTION_TYPE_LABELS[selectedQuestion.questionType] }}
          </span>
          <span
            class="rounded-full px-2 py-1 text-[11px] font-semibold"
            :class="{
              'bg-success/10 text-success': selectedQuestion.status === 'correct',
              'bg-error/10 text-error': selectedQuestion.status === 'wrong',
              'bg-base-200 text-base-content/45': selectedQuestion.status === 'unanswered',
              'bg-warning/10 text-warning': selectedQuestion.status === 'pending',
            }"
          >
            {{ statusLabel(selectedQuestion.status) }}
          </span>
        </div>

        <h3 class="mt-3 whitespace-pre-line text-sm font-medium leading-6">
          {{ selectedQuestion.title }}
        </h3>

        <dl class="mt-4 overflow-hidden rounded-xl border border-base-200 divide-y divide-base-200">
          <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
            <dt class="text-base-content/65">你的答案</dt>
            <dd :class="selectedQuestion.status === 'wrong' ? 'text-error' : ''">
              {{ selectedQuestion.userAnswer || '未作答' }}
            </dd>
          </div>
          <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
            <dt class="text-base-content/65">正确答案</dt>
            <dd class="text-success">{{ selectedQuestion.correctAnswer || '待批阅' }}</dd>
          </div>
        </dl>

        <div class="mt-4 border-t border-base-200 pt-3">
          <h4 class="text-sm font-semibold">题目解析</h4>
          <p class="mt-1.5 whitespace-pre-line text-sm leading-6 text-base-content/60">
            {{ selectedQuestion.explanation || '暂无解析' }}
          </p>
        </div>
      </template>
    </BaseModal>
  </section>
</template>
