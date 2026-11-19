<script setup lang="ts">
import { Compass } from '@lucide/vue'
import { useRouter } from 'vue-router'

import EmptyState from '@/components/common/EmptyState.vue'

const router = useRouter()
</script>

<template>
  <main class="flex min-h-dvh items-center justify-center bg-base-200/80 px-4 dark:bg-base-100">
    <div class="w-full max-w-sm">
      <h1 class="sr-only">页面不存在</h1>
      <EmptyState
        :icon="Compass"
        title="页面不存在"
        description="链接已失效或不存在"
        action-label="返回首页"
        @action="router.push({ name: 'home' })"
      />
    </div>
  </main>
</template>
