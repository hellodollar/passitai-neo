<script setup lang="ts">
import { AlertCircle, FileStack, ListTree } from '@lucide/vue'

withDefaults(
  defineProps<{
    /** 聚合模式下是否显示分组标题 */
    showHeader?: boolean
  }>(),
  {
    showHeader: false,
  },
)
</script>

<template>
  <section class="grid gap-2">
    <h4 v-if="showHeader" class="text-[13px] font-semibold text-base-content/60">错题设置</h4>

    <p class="px-0.5 text-xs text-base-content/45">展示方式</p>

    <!-- 占位:只展示,不接逻辑;分类、排序形式等设置后续补充 -->
    <div class="grid grid-cols-2 gap-2" aria-hidden="true">
      <div class="flex cursor-default flex-col items-center rounded-xl bg-base-200/45 px-2 py-3 text-center">
        <span class="flex size-8 items-center justify-center rounded-full bg-info/10 text-info">
          <ListTree :size="15" />
        </span>
        <span class="mt-1.5 text-xs font-semibold text-base-content/60">按科目展示</span>
      </div>
      <div class="flex cursor-default flex-col items-center rounded-xl bg-base-200/45 px-2 py-3 text-center">
        <span class="flex size-8 items-center justify-center rounded-full bg-warning/15 text-warning">
          <AlertCircle :size="15" />
        </span>
        <span class="mt-1.5 text-xs font-semibold text-base-content/60">按题集展示</span>
      </div>
    </div>
    <p class="flex items-center gap-1.5 px-0.5 text-xs text-base-content/35">
      <FileStack :size="12" class="shrink-0" />
      分类、排序设置即将开放
    </p>
  </section>
</template>
