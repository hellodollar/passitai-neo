<script setup lang="ts">
import { Bell, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useNotificationsStore } from '@/stores/notifications'
import { notificationTime } from '@/utils/notifications'
const router = useRouter(),
  notifications = useNotificationsStore()
const latest = computed(() => notifications.summary?.latestUnread)
</script>
<template>
  <button
    v-if="latest && notifications.unreadCount > 0"
    class="flex w-full items-center gap-2.5 rounded-2xl border border-primary/25 bg-gradient-to-r from-primary/[0.08] to-ai/[0.06] px-3 py-2.5 text-left active:bg-primary/10"
    type="button"
    :aria-label="`最新消息：${latest.title}，${notifications.unreadCount} 条未读`"
    @click="router.push({ name: 'notification-detail', params: { id: latest.id } })"
  >
    <span
      class="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
      ><Bell :size="16" /><span
        class="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-semibold text-error-content"
        >{{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}</span
      ></span
    >
    <span class="min-w-0 flex-1"
      ><span class="block truncate text-[13px] font-semibold">{{ latest.title }}</span
      ><span class="mt-0.5 block text-[11px] text-base-content/55">{{
        notificationTime(latest.publishedAt)
      }}</span></span
    ><ChevronRight :size="16" class="shrink-0 text-base-content/30" />
  </button>
</template>
