<script setup lang="ts">
import { RouterLink } from 'vue-router'

import logoPassitai from '@/assets/icons/icon-passitai.svg'
import { APP_NAME } from '@/constants/app'
</script>

<template>
  <main class="flex min-h-dvh flex-col bg-base-100 px-6 py-8">
    <section class="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center py-6">
      <div class="mb-8 flex justify-center">
        <RouterLink to="/login" :aria-label="`${APP_NAME}首页`" class="transition-opacity hover:opacity-80">
          <img :src="logoPassitai" :alt="APP_NAME" class="h-11 w-auto" />
        </RouterLink>
      </div>

      <slot></slot>
    </section>

    <footer class="text-center text-xs text-base-content/35">
      &copy; 2026 {{ APP_NAME }}
    </footer>
  </main>
</template>
