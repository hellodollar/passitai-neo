<script setup lang="ts">
import LogoPassitai from '@/components/common/LogoPassitai.vue'
import { APP_NAME } from '@/constants/app'
defineProps<{ title: string }>()
</script>

<template>
  <main class="flex min-h-dvh flex-col bg-base-100 px-6 py-4">
    <section class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-2">
      <LogoPassitai
        role="img"
        :aria-label="APP_NAME"
        class="mx-auto mb-5 h-10 w-auto text-base-content"
      />
      <h1 class="mb-5 text-center text-xl font-semibold">{{ title }}</h1>
      <slot></slot>
    </section>
  </main>
</template>
