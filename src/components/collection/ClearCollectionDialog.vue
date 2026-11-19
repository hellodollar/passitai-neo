<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import { clearFavorites } from '@/api/favorites'
import { clearMistakes } from '@/api/mistakes'
import BaseDialog from '@/components/common/BaseDialog.vue'
import { useAuthStore } from '@/stores/auth'
import type { CollectionSource } from '@/types'
import { showErrorToast, showSuccessToast } from '@/utils/toast'

const model = defineModel<boolean>({ default: false })
const props = defineProps<{ source: CollectionSource }>()
const emit = defineEmits<{ cleared: [] }>()
const auth = useAuthStore()
const clearing = ref(false)
const label = computed(() => (props.source === 'favorites' ? '收藏' : '错题'))
let clearSequence = 0

async function confirmClear() {
  if (!model.value || clearing.value || !auth.isAuthenticated) return
  const sequence = ++clearSequence
  const token = auth.session?.token
  const source = props.source
  const isCurrent = () =>
    sequence === clearSequence &&
    model.value &&
    source === props.source &&
    token === auth.session?.token &&
    auth.isAuthenticated
  clearing.value = true
  try {
    await (source === 'favorites' ? clearFavorites() : clearMistakes())
    if (!isCurrent()) return
    showSuccessToast(`${label.value}已清空`)
    model.value = false
    emit('cleared')
  } catch {
    if (isCurrent()) showErrorToast('清空失败，请稍后重试。')
  } finally {
    if (sequence === clearSequence) clearing.value = false
  }
}

watch(model, (open) => {
  if (!open) {
    ++clearSequence
    clearing.value = false
  }
})
watch([() => auth.session?.token, () => props.source], () => {
  ++clearSequence
  clearing.value = false
  model.value = false
})
onBeforeUnmount(() => ++clearSequence)
</script>

<template>
  <BaseDialog
    v-model="model"
    :title="`清空${label}？`"
    :close-on-backdrop="!clearing"
    :close-on-escape="!clearing"
  >
    <p class="text-sm leading-relaxed text-base-content/70">
      将清空当前账号的全部{{ label }}，无法撤销。
    </p>
    <template #footer>
      <button
        class="flex h-10 flex-1 items-center justify-center rounded-xl bg-base-200/70 text-sm font-medium text-base-content/75 transition-colors active:bg-base-200 disabled:opacity-50 dark:bg-base-300/45 dark:active:bg-base-300/70"
        type="button"
        :disabled="clearing"
        @click="model = false"
      >
        取消
      </button>
      <button
        class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-error text-sm font-medium text-error-content transition-colors active:opacity-90 disabled:opacity-50"
        type="button"
        :disabled="clearing"
        @click="confirmClear"
      >
        <span v-if="clearing" class="loading loading-spinner loading-xs"></span>
        清空
      </button>
    </template>
  </BaseDialog>
</template>
