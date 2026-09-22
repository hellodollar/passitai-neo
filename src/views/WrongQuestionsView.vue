<script setup lang="ts">
import { AlertCircle, XCircle } from '@lucide/vue'
import { onMounted, ref } from 'vue'

import EmptyState from '@/components/common/EmptyState.vue'
import ReviewGroup from '@/components/common/ReviewGroup.vue'
import { useLearningStore } from '@/stores/learning'

const learning = useLearningStore()
const expandedIds = ref<Set<string>>(new Set())
const loaded = ref(false)

function toggleExpand(id: string) {
  if (expandedIds.value.has(id)) {
    expandedIds.value.delete(id)
  } else {
    expandedIds.value.add(id)
  }
}

onMounted(async () => {
  try {
    await learning.loadWrongQuestions()
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
          共 {{ learning.wrongQuestionsTotal }}
        </span>
      </div>

      <div class="grid gap-3">
        <ReviewGroup
          v-for="wq in learning.wrongQuestions"
          :key="wq.id"
          :icon="XCircle"
          :expanded="expandedIds.has(wq.id)"
          :title="wq.subjectName"
          :meta="`${wq.total} 道错题`"
          tone="error"
          @toggle="toggleExpand(wq.id)"
          @remove="learning.removeWrongQuestion(wq.id)"
        >
          <ul class="grid gap-2">
            <li
              v-for="item in wq.wrongList"
              :key="item.qid"
              class="flex items-start gap-3 rounded-2xl bg-base-100 p-3"
            >
              <XCircle :size="16" class="mt-0.5 shrink-0 text-error" />
              <div class="min-w-0 flex-1">
                <span class="text-sm font-medium leading-relaxed">{{ item.title }}</span>
                <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-base-content/50">
                  <span class="rounded-full bg-warning/15 px-2 py-0.5 font-semibold text-warning">
                    {{ item.count }}x
                  </span>
                  <span v-if="Array.isArray(item.userAnswer)">
                    我的答案：{{ item.userAnswer.join(', ') }}
                  </span>
                  <span v-else>我的答案：{{ item.userAnswer }}</span>
                </div>
              </div>
            </li>
          </ul>
        </ReviewGroup>
      </div>
    </section>
  </section>
</template>
