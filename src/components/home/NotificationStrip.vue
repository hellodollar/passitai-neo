<script setup lang="ts">
import { Bell, ChevronRight } from '@lucide/vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useNotificationSettingsStore } from '@/stores/notification-settings'
import { useNotificationsStore } from '@/stores/notifications'
import { formatShanghaiDateTime } from '@/utils/date'
const router = useRouter(),
  notifications = useNotificationsStore()
const preferences = useNotificationSettingsStore()
const latest = computed(() => notifications.summary?.latestUnread)
</script>
<template>
  <button
    v-if="preferences.settings?.inAppBanner && latest && notifications.unreadCount > 0"
    class="flex w-full items-center gap-3 rounded-2xl bg-base-100 px-3.5 py-2.5 text-left transition-colors active:bg-base-200/60 dark:bg-base-200 dark:active:bg-base-300/50"
    type="button"
    :aria-label="`新消息，${notifications.unreadCount} 条未读`"
    @click="router.push({ name: 'notifications' })"
  >
    <span
      class="relative flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
      ><Bell :size="16" /><span
        class="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-base-100 bg-error px-1 text-[11px] font-semibold leading-none tabular-nums text-error-content dark:border-base-200"
        >{{ notifications.unreadCount > 99 ? '99+' : notifications.unreadCount }}</span
      ></span
    >
    <span class="min-w-0 flex-1"
      ><span class="block truncate text-sm font-medium leading-snug text-base-content">{{
        preferences.settings?.contentPreview ? latest.title : '你有新消息'
      }}</span
      ><span class="mt-0.5 block text-xs leading-snug text-base-content/55">{{
        formatShanghaiDateTime(latest.publishedAt)
      }}</span></span
    ><ChevronRight :size="15" class="shrink-0 text-base-content/30" />
  </button>
</template>
