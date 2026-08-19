<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { APP_NAME, APP_TAGLINE } from '@/constants/app'

defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <main class="min-h-screen bg-base-100 px-5 py-6">
    <section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-sm flex-col">
      <header class="flex items-center justify-between">
        <RouterLink to="/login" class="text-xl font-bold leading-tight text-primary" aria-label="返回登录页">
          {{ APP_NAME }}
        </RouterLink>
      </header>

      <div class="my-auto py-10">
        <div class="mb-8">
          <h1 class="text-3xl font-semibold leading-tight">{{ title }}</h1>
          <p class="mt-2 text-sm leading-relaxed text-base-content/60">{{ subtitle }}</p>
        </div>

        <slot></slot>
      </div>

      <p class="mt-10 text-center text-sm text-base-content/40">
        {{ APP_TAGLINE }}
      </p>
    </section>
  </main>
</template>
