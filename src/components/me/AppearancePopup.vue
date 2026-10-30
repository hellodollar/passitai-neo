<script setup lang="ts">
import { Check, Monitor, Moon, Sun } from '@lucide/vue'

import BasePopup from '@/components/common/BasePopup.vue'
import {
  APPEARANCE_LABELS,
  useAppearance,
  type AppearancePreference,
} from '@/composables/useAppearance'

const model = defineModel<boolean>({ default: false })

const { appearance: currentAppearance, setAppearance } = useAppearance()

const OPTIONS: Array<{ value: AppearancePreference; icon: typeof Sun; description: string }> = [
  { value: 'system', icon: Monitor, description: '按系统设置自动切换深浅' },
  { value: 'light', icon: Sun, description: '始终使用浅色外观' },
  { value: 'dark', icon: Moon, description: '始终使用深色外观' },
]
</script>

<template>
  <!-- 即选即生效:保持弹层打开,用户可在遮罩外直接看到切换效果 -->
  <BasePopup v-model="model" title="外观">
    <div role="radiogroup" aria-label="外观模式" class="grid gap-2">
      <button
        v-for="option in OPTIONS"
        :key="option.value"
        class="flex min-h-13 w-full items-center gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors"
        :class="
          currentAppearance === option.value
            ? 'border-primary/40 bg-primary/5'
            : 'border-base-200 active:bg-base-200/60'
        "
        type="button"
        role="radio"
        :aria-checked="currentAppearance === option.value"
        @click="setAppearance(option.value)"
      >
        <component
          :is="option.icon"
          :size="19"
          stroke-width="1.8"
          class="shrink-0"
          :class="currentAppearance === option.value ? 'text-primary' : 'text-base-content/55'"
          aria-hidden="true"
        />
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-medium leading-5">
            {{ APPEARANCE_LABELS[option.value] }}
          </span>
          <span class="block truncate text-xs leading-4 text-base-content/50">
            {{ option.description }}
          </span>
        </span>
        <Check
          v-if="currentAppearance === option.value"
          :size="17"
          class="shrink-0 text-primary"
          aria-hidden="true"
        />
      </button>
    </div>
  </BasePopup>
</template>
