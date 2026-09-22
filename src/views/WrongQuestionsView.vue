<script setup lang="ts">
import { AlertCircle, Play, Trash2, XCircle } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import { fetchPracticeAnswerSheet } from '@/api/practice'
import EmptyState from '@/components/common/EmptyState.vue'
import { useLearningStore } from '@/stores/learning'

const learning = useLearningStore()
const loaded = ref(false)
const questionDetails = ref<Record<string, { paperName: string; title: string }>>({})

async function loadQuestionDetails() {
  const paperIds = [...new Set(learning.wrongQuestions.map((item) => item.paperId))]
  const results = await Promise.allSettled(paperIds.map(fetchPracticeAnswerSheet))
  const details: Record<string, { paperName: string; title: string }> = {}

  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    for (const group of result.value.questionGroups) {
      for (const question of group.items) {
        details[question.id] = { paperName: result.value.paperName, title: question.title }
      }
    }
  }
  questionDetails.value = details
}

onMounted(async () => {
  try {
    await learning.loadWrongQuestions()
    await loadQuestionDetails()
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <section class="flex min-h-[calc(100vh-8rem)] flex-col space-y-5">
    <div
      v-if="loaded && learning.wrongQuestions.length === 0"
      class="flex w-full flex-1 items-center justify-center"
    >
      <EmptyState
        :icon="AlertCircle"
        title="暂无错题"
        description="答错的题目会自动收集到这里。"
        action-label="去练习"
        action-to="/"
      />
    </div>

    <section v-else-if="loaded">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">错题本</h2>
        <span class="rounded-full bg-base-200 px-3 py-1.5 text-sm font-medium text-base-content/65">
          共 {{ learning.wrongQuestionsTotal }} 道
        </span>
      </div>

      <div class="grid gap-3">
        <article
          v-for="item in learning.wrongQuestions"
          :key="item.id"
          class="flex items-center gap-3 rounded-2xl border border-base-200 bg-base-100 p-3"
        >
          <span
            class="flex size-10 shrink-0 items-center justify-center rounded-full bg-error/10 text-error"
          >
            <XCircle :size="20" />
          </span>

          <div class="min-w-0 flex-1">
            <p class="line-clamp-2 text-sm font-medium leading-relaxed">
              {{ questionDetails[item.questionId]?.title ?? `题目 ${item.questionId}` }}
            </p>
            <p class="mt-1 truncate text-xs text-base-content/45">
              {{ questionDetails[item.questionId]?.paperName ?? `试卷 ${item.paperId}` }}
            </p>
          </div>

          <RouterLink
            class="btn btn-square btn-ghost btn-sm text-primary"
            :to="`/practice/session/${item.paperId}`"
            aria-label="重新练习"
          >
            <Play :size="16" />
          </RouterLink>
          <button
            class="btn btn-square btn-ghost btn-sm text-error"
            type="button"
            aria-label="移除错题"
            @click="learning.removeWrongQuestion(item.questionId)"
          >
            <Trash2 :size="16" />
          </button>
        </article>
      </div>
    </section>
  </section>
</template>
