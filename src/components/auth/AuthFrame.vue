<script setup lang="ts">
import LogoPassitai from '@/components/common/LogoPassitai.vue'
import { APP_NAME } from '@/constants/app'

defineProps<{ title: string }>()

const currentYear = new Date().getFullYear()
</script>

<template>
  <main
    class="flex min-h-dvh flex-col bg-base-100 px-5 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]"
  >
    <section class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-2">
      <LogoPassitai
        role="img"
        :aria-label="APP_NAME"
        class="mx-auto mb-5 h-10 w-auto text-base-content"
      />
      <h1 class="mb-5 text-center text-xl font-semibold tracking-tight text-base-content">
        {{ title }}
      </h1>
      <slot></slot>
    </section>
    <footer class="shrink-0 pt-4 text-center text-[11px] text-base-content/35">
      © {{ currentYear }} {{ APP_NAME }}
    </footer>
  </main>
</template>
