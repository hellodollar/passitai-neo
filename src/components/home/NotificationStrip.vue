<script setup lang="ts">
import { Bell, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useNotificationSettingsStore } from '@/stores/notification-settings'
import { useNotificationsStore } from '@/stores/notifications'
import { notificationTime } from '@/utils/notifications'
const router = useRouter(),
  notifications = useNotificationsStore()
const preferences = useNotificationSettingsStore()
const latest = computed(() => notifications.summary?.latestUnread)
</script>
<template>
  <button
    v-if="preferences.settings?.inAppBanner && latest && notifications.unreadCount > 0"
    class="flex w-full items-center gap-3 rounded-2xl bg-base-100 px-3.5 py-2.5 text-left transition-colors active:bg-base-100/80 dark:bg-base-200 dark:active:bg-base-300/60"
    type="button"
    :aria-label="`新消息，${notifications.unreadCount} 条未读`"
    @click="router.push({ name: 'notification-detail', params: { id: latest.id } })"
  >
    <span
      class="relative flex size-8.5 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
      ><Bell :size="16" /><span
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-base-100 bg-error px-1 text-[10px] font-semibold text-error-content dark:border-base-200"
        >{{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}</span
      ></span
    >
    <span class="min-w-0 flex-1"
      ><span class="block truncate text-[13px] font-semibold text-base-content">{{
        preferences.settings?.contentPreview ? latest.title : '你有新消息'
      }}</span
      ><span class="mt-0.5 block text-[11px] text-base-content/50">{{
        notificationTime(latest.publishedAt)
      }}</span></span
    ><ChevronRight :size="15" class="shrink-0 text-base-content/35" />
  </button>
</template>
