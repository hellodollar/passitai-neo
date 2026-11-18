<script setup lang="ts">
import { ref, watch } from 'vue'

import { fetchPracticeTemplates } from '@/api/practice-templates'
import { useAuthStore } from '@/stores/auth'
import type { Paper } from '@/types/paper'
import type { PracticeTemplate } from '@/types/practice-template'

const props = defineProps<{ subjectCode: string }>()
const emit = defineEmits<{ 'open-paper': [paper: Paper]; loaded: [] }>()
const auth = useAuthStore()
const templates = ref<PracticeTemplate[]>([])
const loading = ref(false)
const error = ref(false)
const retry = ref(0)

watch(
  [() => props.subjectCode, () => auth.session?.token, retry],
  async ([code, token], _, onCleanup) => {
    templates.value = []
    error.value = false
    loading.value = Boolean(token && code)
    if (!token || !code) return
    const controller = new AbortController()
    onCleanup(() => controller.abort())
    try {
      const result = await fetchPracticeTemplates(code, controller.signal)
      if (controller.signal.aborted) return
      templates.value = result
      emit('loaded')
    } catch {
      if (!controller.signal.aborted) error.value = true
    } finally {
      if (!controller.signal.aborted) loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <section class="border-t border-base-200 px-4 py-3" aria-label="练习模板">
    <h2 class="text-sm font-semibold">练习模板</h2>
    <p v-if="loading" role="status" class="mt-2 text-sm text-base-content/65">正在加载练习模板…</p>
    <div v-else-if="error" role="alert" class="mt-2 flex items-center gap-2">
      <p class="text-sm text-error">练习模板加载失败</p>
      <button class="btn btn-ghost btn-xs" type="button" @click="retry++">重试</button>
    </div>
    <p v-else-if="!templates.length" class="mt-2 text-sm text-base-content/65">暂无练习模板</p>
    <ul v-else class="mt-2 divide-y divide-base-200">
      <li v-for="template in templates" :key="template.id" class="py-2">
        <div class="flex items-center justify-between gap-3">
          <h3 class="break-words text-sm font-medium">{{ template.name }}</h3>
          <span v-if="!template.list.length" class="shrink-0 text-xs text-base-content/65"
            >暂无题集</span
          >
        </div>
        <ul v-if="template.list.length" class="mt-1">
          <li v-for="paper in template.list" :key="paper.id">
            <button
              class="btn btn-ghost btn-sm h-auto min-h-8 text-left"
              type="button"
              @click="emit('open-paper', paper)"
            >
              {{ paper.name }}
            </button>
          </li>
        </ul>
      </li>
    </ul>
  </section>
</template>
