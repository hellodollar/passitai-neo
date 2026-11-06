<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import BottomTabBar from '@/components/BottomTabBar.vue'
import AppToast from '@/components/common/AppToast.vue'

const route = useRoute()
const showShell = computed(
  () => route.name && !['login', 'register', 'not-found'].includes(String(route.name)),
)
const showTabs = computed(() =>
  ['home', 'favorites', 'mistakes', 'me'].includes(String(route.name)),
)
</script>

<template>
  <div v-if="showShell" class="min-h-screen overflow-x-hidden bg-base-100 text-base-content">
    <div
      class="mx-auto min-h-screen w-full max-w-[32rem] overflow-x-hidden bg-base-100 md:border-x md:border-base-300"
    >
      <main class="min-w-0 overflow-x-hidden">
        <RouterView />
      </main>
      <BottomTabBar
        v-if="showTabs"
        class="fixed bottom-0 left-1/2 z-30 w-full max-w-[32rem] -translate-x-1/2 border-t border-base-200 bg-base-100/95 px-3 pb-[calc(0.45rem+env(safe-area-inset-bottom))] pt-1.5 backdrop-blur"
      />
    </div>
  </div>
  <RouterView v-else />
  <AppToast />
</template>
