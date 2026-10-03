<script setup lang="ts">
import { AlertCircle, Play, Trash2, XCircle } from '@lucide/vue'
import { onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'

import EmptyState from '@/components/common/EmptyState.vue'
import { ROUTE_NAMES } from '@/constants/app'
import { useLearningStore } from '@/stores/learning'
import { showErrorToast } from '@/utils/toast'

const learning = useLearningStore()
const loaded = ref(false)
const loadError = ref(false)

async function loadWrongQuestions() {
  loaded.value = false
  loadError.value = false
  try {
    await learning.loadWrongQuestions()
  } catch {
    loadError.value = true
  } finally {
    loaded.value = true
  }
}

async function removeWrongQuestion(id: string) {
  try {
    await learning.removeWrongQuestion(id)
  } catch {
    showErrorToast('移除错题失败，请稍后重试。')
  }
}

onMounted(loadWrongQuestions)
</script>

<template>
  <section class="flex min-h-[calc(100vh-8rem)] flex-col space-y-5">
    <div v-if="loaded && loadError" class="flex w-full flex-1 items-center justify-center">
      <EmptyState
        :icon="AlertCircle"
        tone="error"
        title="错题加载失败"
        description="请检查网络后重试。"
        action-label="重新加载"
        @action="loadWrongQuestions"
      />
    </div>

    <div
      v-else-if="loaded && learning.wrongQuestions.length === 0"
      class="flex w-full flex-1 items-center justify-center"
    >
      <EmptyState
        :icon="AlertCircle"
        tone="warning"
        title="暂无错题"
        description="答错的题目会自动收集到这里。"
        action-label="去练习"
        action-to="/"
      />
    </div>

    <section v-else-if="loaded">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">错题本</h2>
        <span class="rounded-full bg-base-200 px-3 py-1.5 text-sm font-medium text-base-content/60">
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
              {{ item.title ?? `题目 ${item.questionId}` }}
            </p>
            <p class="mt-1 truncate text-xs text-base-content/45">
              {{ item.paperName ?? `试卷 ${item.paperId}` }}
            </p>
          </div>

          <RouterLink
            class="btn btn-square btn-ghost btn-sm text-primary"
            :to="{ name: ROUTE_NAMES.practicePaper, params: { paperId: item.paperId } }"
            aria-label="重新练习"
          >
            <Play :size="16" />
          </RouterLink>
          <button
            class="btn btn-square btn-ghost btn-sm text-error"
            type="button"
            aria-label="移除错题"
            @click="removeWrongQuestion(item.id)"
          >
            <Trash2 :size="16" />
          </button>
        </article>
      </div>
    </section>
  </section>
</template>
