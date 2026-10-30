<script setup lang="ts">
import { RouterLink } from 'vue-router'

import LogoPassitai from '@/components/common/LogoPassitai.vue'
import { APP_NAME } from '@/constants/app'
</script>

<template>
  <main class="flex min-h-dvh flex-col bg-base-100 px-6 py-4">
    <section class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-2">
      <div class="mb-5 flex justify-center">
        <RouterLink
          :to="{ name: 'login' }"
          :aria-label="`${APP_NAME}登录`"
          class="transition-opacity hover:opacity-80"
        >
          <LogoPassitai
            role="img"
            :aria-label="APP_NAME"
            class="h-11 w-auto text-base-content"
          />
        </RouterLink>
      </div>

      <slot></slot>
    </section>

    <footer class="text-center text-xs text-base-content/35">&copy; 2026 {{ APP_NAME }}</footer>
  </main>
</template>
