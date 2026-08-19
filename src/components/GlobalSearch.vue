<script setup lang="ts">
import { Search } from '@lucide/vue'

import { useAppStore } from '@/stores/app'

const app = useAppStore()
</script>

<template>
  <label class="input input-bordered hidden h-10 max-w-md flex-1 items-center gap-2 md:flex">
    <Search :size="18" class="text-base-content/45" />
    <input
      :value="app.globalSearch"
      type="search"
      class="grow"
      placeholder="Search papers, subjects..."
      @input="app.setGlobalSearch(($event.target as HTMLInputElement).value)"
    />
  </label>
</template>
