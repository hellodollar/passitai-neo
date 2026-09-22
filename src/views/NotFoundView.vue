<script setup lang="ts">
import { Compass } from '@lucide/vue'
import { RouterLink } from 'vue-router'
</script>

<template>
  <main class="flex min-h-screen items-center justify-center bg-base-200 px-4">
    <section class="w-full max-w-sm rounded-2xl border border-base-200 bg-base-100 p-6 text-center">
      <div class="flex flex-col items-center">
        <Compass :size="36" class="text-primary" />
        <h1 class="mt-4 text-xl font-semibold">页面不存在</h1>
        <p class="text-base-content/65">当前访问地址已失效或不存在。</p>
        <RouterLink class="btn btn-primary mt-4 h-11 rounded-full" to="/">返回首页</RouterLink>
      </div>
    </section>
  </main>
</template>
