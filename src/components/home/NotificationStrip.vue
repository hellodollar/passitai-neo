<script setup lang="ts">
import { CalendarDays, ChevronRight } from '@lucide/vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

/**
 * 首页通知公告条(静态还原):展示最新一条未读消息,点击进入详情;
 * 数据为组件内占位,接口落地后由未读数与最新消息驱动,无未读时整条隐藏。
 */
const router = useRouter()

// —— 占位数据(接口就绪后删除) ——
const unreadCount = ref(3)
const latest = {
  id: 'ntf-exam-1109',
  title: '考试临近:中国近现代史纲要还有 7 天开考',
  timeLabel: '最新一条 · 今天 09:00',
}

const visible = computed(() => unreadCount.value > 0)

function openDetail() {
  void router.push({ name: 'notification-detail', params: { id: latest.id } })
}
</script>

<template>
  <button
    v-if="visible"
    class="flex w-full items-center gap-2.5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/[0.08] to-ai/[0.06] px-3 py-2.5 text-left transition-colors active:bg-primary/10"
    type="button"
    aria-label="最新消息:考试临近,3 条未读"
    @click="openDetail"
  >
    <span class="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
      <CalendarDays :size="16" />
      <span
        class="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-error-content"
        >{{ unreadCount }}</span
      >
    </span>
    <span class="min-w-0 flex-1">
      <span class="block truncate text-[13px] font-semibold">{{ latest.title }}</span>
      <span class="mt-0.5 block text-[11px] text-base-content/55">{{ latest.timeLabel }}</span>
    </span>
    <ChevronRight :size="16" class="shrink-0 text-base-content/30" />
  </button>
</template>
