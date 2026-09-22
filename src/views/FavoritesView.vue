<script setup lang="ts">
import { Bookmark, BookOpenCheck } from '@lucide/vue'
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
    await learning.loadFavorites()
  } finally {
    loaded.value = true
  }
})
</script>

<template>
  <section class="flex min-h-[calc(100vh-8rem)] flex-col space-y-5">
    <div
      v-if="loaded && learning.favorites.length === 0"
      class="flex w-full flex-1 items-center justify-center"
    >
      <EmptyState
        :icon="BookOpenCheck"
        title="暂无收藏"
        description="练习时收藏的题目会出现在这里。"
        action-label="去练习"
        action-to="/"
      />
    </div>

    <section v-else-if="loaded">
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-lg font-semibold">收藏题目</h2>
        <span class="rounded-full bg-base-200 px-3 py-1.5 text-sm font-medium text-base-content/65">
          共 {{ learning.favoritesTotal }}
        </span>
      </div>

      <div class="grid gap-3">
        <ReviewGroup
          v-for="fav in learning.favorites"
          :key="fav.id"
          :icon="Bookmark"
          :expanded="expandedIds.has(fav.id)"
          :title="fav.subjectName"
          :meta="`${fav.total} 道收藏题`"
          @toggle="toggleExpand(fav.id)"
          @remove="learning.removeFavorite(fav.id)"
        >
          <ul class="grid gap-2">
            <li
              v-for="question in fav.questions"
              :key="question.qid"
              class="flex items-start gap-3 rounded-2xl bg-base-100 p-3"
            >
              <Bookmark :size="16" class="mt-0.5 shrink-0 fill-primary text-primary" />
              <span class="text-sm leading-relaxed">{{ question.title }}</span>
            </li>
          </ul>
        </ReviewGroup>
      </div>
    </section>
  </section>
</template>
