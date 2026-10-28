<script setup lang="ts">
import { ArrowDown, ArrowUp, Target } from '@lucide/vue'

import BasePopup from '@/components/common/BasePopup.vue'
import EmptyState from '@/components/common/EmptyState.vue'
import type { PracticePlanSubject } from '@/types/practice'

const model = defineModel<boolean>({ default: false })
defineProps<{
  subjects: PracticePlanSubject[]
  activeSubjectCode?: string
  hiddenSubjectCodes: ReadonlySet<string>
}>()
const emit = defineEmits<{
  select: [code: string]
  'toggle-visibility': [code: string]
  move: [code: string, direction: -1 | 1]
}>()
</script>

<template>
  <BasePopup v-model="model" title="科目管理">
    <p class="text-xs text-base-content/65">勾选显示，使用箭头调整顺序</p>

    <div class="mt-3 border-y border-base-200 divide-y divide-base-200">
      <div
        v-for="(subject, index) in subjects"
        :key="subject.code"
        class="flex min-h-14 min-w-0 items-center gap-2 py-1.5"
      >
        <label class="flex size-8 shrink-0 cursor-pointer items-center justify-center">
          <input
            type="checkbox"
            class="checkbox checkbox-xs checkbox-primary"
            :checked="!hiddenSubjectCodes.has(subject.code)"
            :aria-label="`${subject.name}显示状态`"
            @change="emit('toggle-visibility', subject.code)"
          />
        </label>

        <button
          class="min-w-0 flex-1 text-left"
          :class="[
            activeSubjectCode === subject.code ? 'text-primary' : '',
            hiddenSubjectCodes.has(subject.code) ? 'text-base-content/35' : '',
          ]"
          type="button"
          @click="emit('select', subject.code)"
        >
          <span class="block truncate text-sm font-medium">{{ subject.name }}</span>
          <span v-if="subject.code" class="mt-0.5 block truncate text-[11px] text-base-content/40">
            {{ subject.code }}
          </span>
        </button>

        <div class="flex shrink-0 items-center gap-0.5">
          <button
            class="btn btn-square btn-ghost btn-sm text-base-content/55"
            type="button"
            aria-label="上移科目"
            :disabled="index === 0"
            @click="emit('move', subject.code, -1)"
          >
            <ArrowUp :size="15" />
          </button>
          <button
            class="btn btn-square btn-ghost btn-sm text-base-content/55"
            type="button"
            aria-label="下移科目"
            :disabled="index === subjects.length - 1"
            @click="emit('move', subject.code, 1)"
          >
            <ArrowDown :size="15" />
          </button>
        </div>
      </div>

      <EmptyState
        v-if="subjects.length === 0"
        :icon="Target"
        title="暂无可管理科目"
        description="暂无练习计划科目。"
        embedded
      />
    </div>
  </BasePopup>
</template>
