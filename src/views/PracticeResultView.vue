<script setup lang="ts">
import { ArrowLeft, CheckCircle2, CircleAlert, Clock3, FileCheck2 } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { fetchPracticeAnswerSheet, fetchPracticeSubmissionResult } from '@/api/practice'
import BaseModal from '@/components/common/BaseModal.vue'
import { ROUTE_NAMES } from '@/constants/app'
import { QUESTION_TYPE_LABELS } from '@/constants/domain'
import { useAppStore } from '@/stores/app'
import type {
  PracticeAnswerSheet,
  PracticeAnswerSheetItem,
  PracticeResultQuestion,
  PracticeResultQuestionStatus,
  PracticeSubmissionResult,
  QuestionType,
} from '@/types/domain'
import { readPracticeResultSnapshot } from '@/utils/practice-result'

const router = useRouter()
const route = useRoute()
const app = useAppStore()

const result = ref<PracticeSubmissionResult | null>(null)
const loading = ref(true)
const loadError = ref(false)
const detailOpen = ref(false)
const selectedQuestion = ref<PracticeResultQuestion | null>(null)
const resultFilter = ref<'all' | 'review'>('all')

const paperId = computed(() =>
  typeof route.params.paperId === 'string' ? route.params.paperId : '',
)
const submissionId = computed(() =>
  typeof route.query.submissionId === 'string' ? route.query.submissionId : '',
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

const reportMessage = computed(() => {
  const accuracy = result.value?.accuracy ?? 0
  if (accuracy >= 80) {
    return {
      icon: CheckCircle2,
      title: '本次掌握不错',
      description: '基础较稳，可以继续推进下一组练习。',
      classes: 'bg-success/10 text-success',
    }
  }
  if (accuracy >= 60) {
    return {
      icon: FileCheck2,
      title: '还有提升空间',
      description: '建议优先复习错题，再进行一轮针对训练。',
      classes: 'bg-primary/10 text-primary',
    }
  }
  return {
    icon: CircleAlert,
    title: '建议先巩固薄弱点',
    description: '本次错题较多，可以从错题解析开始复习。',
    classes: 'bg-warning/15 text-warning',
  }
})

const elapsedText = computed(() => {
  const seconds = result.value?.elapsedSeconds
  if (typeof seconds !== 'number') return ''
  const minutes = Math.floor(seconds / 60)
  const restSeconds = seconds % 60
  return minutes > 0 ? `${minutes}分${restSeconds}秒` : `${restSeconds}秒`
})

function normalizeAnswer(answer: string) {
  return answer
    .toUpperCase()
    .split(/[\s,，、;；]/)
    .map((value) => value.trim())
    .filter(Boolean)
    .sort()
    .join(',')
}

function sheetQuestionStatus(item: PracticeAnswerSheetItem): PracticeResultQuestionStatus {
  if (!item.userAnswer) return 'unanswered'
  if (!item.correctAnswer) return 'pending'
  return normalizeAnswer(item.userAnswer) === normalizeAnswer(item.correctAnswer)
    ? 'correct'
    : 'wrong'
}

function buildFallbackResult(sheet: PracticeAnswerSheet): PracticeSubmissionResult {
  let index = 0
  const questions = sheet.questionGroups.flatMap((group) =>
    group.items.map((item) => {
      index += 1
      return {
        id: item.id,
        index,
        title: item.title,
        questionType: item.questionType as QuestionType,
        userAnswer: item.userAnswer ?? '',
        correctAnswer: item.correctAnswer,
        explanation: item.explanation ?? undefined,
        status: sheetQuestionStatus(item),
      }
    }),
  )

  const correctCount = questions.filter((question) => question.status === 'correct').length
  const wrongCount = questions.filter((question) => question.status === 'wrong').length
  const unansweredCount = questions.filter((question) => question.status === 'unanswered').length
  const totalCount = questions.length
  const gradedCount = correctCount + wrongCount

  return {
    submissionId: submissionId.value || `preview_${paperId.value}`,
    paperId: paperId.value,
    paperName: sheet.paperName,
    subjectName: typeof route.query.subject === 'string' ? route.query.subject : '',
    score: sheet.score,
    totalCount,
    answeredCount: totalCount - unansweredCount,
    correctCount,
    wrongCount,
    unansweredCount,
    accuracy: gradedCount > 0 ? Math.round((correctCount / gradedCount) * 100) : 0,
    questions,
    placeholder: true,
  }
}

async function loadResult() {
  if (!paperId.value) {
    loadError.value = true
    loading.value = false
    return
  }

  const snapshot = readPracticeResultSnapshot(paperId.value)
  if (snapshot) {
    result.value = snapshot
    loading.value = false
  }

  try {
    const remoteResult = await fetchPracticeSubmissionResult(
      paperId.value,
      submissionId.value || undefined,
    )
    if (!snapshot || !remoteResult.placeholder) {
      result.value = remoteResult
    }
    loading.value = false
    return
  } catch {
    if (snapshot) return
  }

  try {
    const sheet = await fetchPracticeAnswerSheet(paperId.value)
    result.value = buildFallbackResult(sheet)
  } catch {
    loadError.value = true
  } finally {
    loading.value = false
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
  router.push({ name: ROUTE_NAMES.practice })
}

onMounted(() => {
  app.setPracticeSessionActive(true)
  void loadResult()
})

onBeforeUnmount(() => {
  app.endPracticeSession()
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
          <p class="mt-2 text-sm leading-6 text-base-content/50">暂时无法获取本次作答结果。</p>
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
          <div class="px-4 pb-4 pt-4">
            <p class="truncate text-xs font-medium text-base-content/45">
              {{ result.subjectName || '本次练习' }}
            </p>
            <h2 class="mt-1 truncate text-lg font-semibold">{{ result.paperName }}</h2>

            <div class="mt-4 flex items-center gap-5">
              <div
                class="radial-progress shrink-0 text-primary"
                :style="{
                  '--value': result.accuracy,
                  '--size': '6.5rem',
                  '--thickness': '0.5rem',
                }"
                role="progressbar"
                :aria-valuenow="result.accuracy"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span class="text-center text-base-content">
                  <strong class="block text-2xl font-semibold tabular-nums">
                    {{ result.accuracy }}%
                  </strong>
                  <span class="mt-0.5 block text-[11px] text-base-content/45">正确率</span>
                </span>
              </div>

              <div class="min-w-0 flex-1">
                <span
                  class="flex size-9 items-center justify-center rounded-xl"
                  :class="reportMessage.classes"
                >
                  <component :is="reportMessage.icon" :size="18" />
                </span>
                <h3 class="mt-2 text-base font-semibold">{{ reportMessage.title }}</h3>
                <p class="mt-1 text-xs leading-5 text-base-content/50">
                  {{ reportMessage.description }}
                </p>
              </div>
            </div>
          </div>

          <dl class="grid grid-cols-4 divide-x divide-base-200 border-t border-base-200">
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/40">总题数</dt>
              <dd class="mt-1 text-base font-semibold tabular-nums">{{ result.totalCount }}</dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/40">正确</dt>
              <dd class="mt-1 text-base font-semibold text-success tabular-nums">
                {{ result.correctCount }}
              </dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/40">错误</dt>
              <dd class="mt-1 text-base font-semibold text-error tabular-nums">
                {{ result.wrongCount }}
              </dd>
            </div>
            <div class="px-2 py-3 text-center">
              <dt class="text-[11px] text-base-content/40">未答</dt>
              <dd class="mt-1 text-base font-semibold text-base-content/55 tabular-nums">
                {{ result.unansweredCount }}
              </dd>
            </div>
          </dl>

          <div
            v-if="elapsedText"
            class="flex items-center justify-center gap-1.5 border-t border-base-200 py-2.5 text-xs text-base-content/45"
          >
            <Clock3 :size="14" />
            本次用时 {{ elapsedText }}
          </div>
        </section>

        <section class="mt-4 overflow-hidden rounded-2xl border border-base-200 bg-base-100">
          <div class="flex items-center justify-between gap-3 px-4 py-3.5">
            <div>
              <h2 class="text-base font-semibold">作答明细</h2>
              <p class="mt-0.5 text-xs text-base-content/45">点击题号查看答案与解析</p>
            </div>
            <div class="flex rounded-lg bg-base-200/70 p-0.5 text-xs">
              <button
                class="rounded-md px-2.5 py-1.5 font-medium transition"
                :class="
                  resultFilter === 'all' ? 'bg-base-100 text-primary' : 'text-base-content/45'
                "
                type="button"
                @click="resultFilter = 'all'"
              >
                全部
              </button>
              <button
                class="rounded-md px-2.5 py-1.5 font-medium transition"
                :class="
                  resultFilter === 'review' ? 'bg-base-100 text-error' : 'text-base-content/45'
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
            <span class="flex items-center gap-1.5 text-base-content/50">
              <span class="size-2 rounded-full bg-success"></span>正确
            </span>
            <span class="flex items-center gap-1.5 text-base-content/50">
              <span class="size-2 rounded-full bg-error"></span>错误
            </span>
            <span class="flex items-center gap-1.5 text-base-content/50">
              <span class="size-2 rounded-full border border-base-300 bg-base-100"></span>未答
            </span>
            <span class="flex items-center gap-1.5 text-base-content/50">
              <span class="size-2 rounded-full bg-warning/60"></span>待批阅
            </span>
          </div>

          <div v-if="questionGroups.length > 0" class="grid gap-4 p-4">
            <div v-for="[type, questions] in questionGroups" :key="type">
              <p class="mb-2 text-xs font-medium text-base-content/45">
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

          <div v-else class="px-5 py-10 text-center text-sm text-base-content/45">
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
          <span class="text-xs font-medium text-base-content/45">
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
            <dt class="text-base-content/45">你的答案</dt>
            <dd :class="selectedQuestion.status === 'wrong' ? 'text-error' : ''">
              {{ selectedQuestion.userAnswer || '未作答' }}
            </dd>
          </div>
          <div class="grid grid-cols-[5rem_minmax(0,1fr)] gap-3 px-3 py-2.5 text-sm">
            <dt class="text-base-content/45">正确答案</dt>
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
