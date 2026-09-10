<script setup lang="ts">
import { RouterLink } from 'vue-router'

import logoPassitai from '@/assets/icons/icon-passitai.svg'
import { APP_TAGLINE } from '@/constants/app'

defineProps<{
  title: string
  subtitle: string
}>()
</script>

<template>
  <main class="min-h-screen bg-base-100 px-5 py-6">
    <section class="mx-auto flex min-h-[calc(100dvh-3rem)] w-full max-w-sm flex-col">
      <header class="flex items-center justify-between">
        <RouterLink to="/login" aria-label="返回登录页">
          <img :src="logoPassitai" alt="Passitai" class="h-8 w-auto" />
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
