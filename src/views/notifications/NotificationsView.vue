<script setup lang="ts">
import { Bell, CheckCheck, Megaphone } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { fetchNotifications } from '@/api/notifications'
import EmptyState from '@/components/common/EmptyState.vue'
import PageHeader from '@/components/common/PageHeader.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationSettingsStore } from '@/stores/notification-settings'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationItem } from '@/types'
import { navigateBackOrReplace } from '@/utils/browse/navigation'
import { notificationDayGroup, notificationTime } from '@/utils/notifications'
import { createSessionGuard } from '@/utils/session-guard'

const router = useRouter()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const items = ref<NotificationItem[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const marking = ref(false)
const error = ref('')
const unreadOnly = ref(false)
const preferences = useNotificationSettingsStore()
void preferences.load()

const groups = computed(() =>
  ['今天', '昨天', '更早']
    .map((label) => ({
      label,
      items: items.value.filter((item) => notificationDayGroup(item.publishedAt) === label),
    }))
    .filter((group) => group.items.length),
)

const guard = createSessionGuard()
let version = 0
let disposed = false

function goBack() {
  navigateBackOrReplace(router, '/', ['/', '/me'])
}

async function load(append = false) {
  const current = ++version
  const isCurrent = guard.captureRead()
  const targetPage = append ? page.value + 1 : 1
  loading.value = true
  error.value = ''
  if (!append) {
    items.value = []
    total.value = 0
    page.value = 1
  }
  try {
    const result = await fetchNotifications({
      page: targetPage,
      unread: unreadOnly.value ? 'true' : undefined,
    })
    if (disposed || current !== version || !isCurrent()) return
    // 分页期间新发布的消息可能改变边界；同一条只展示一次。
    items.value = [
      ...new Map(
        [...(append ? items.value : []), ...result.items].map((item) => [item.id, item]),
      ).values(),
    ]
    total.value = result.total
    page.value = targetPage
  } catch (e) {
    if (!disposed && current === version && isCurrent()) {
      error.value = e instanceof Error ? e.message : '消息获取失败'
    }
  } finally {
    if (!disposed && current === version) loading.value = false
  }
}

async function markAll() {
  if (marking.value) return
  const isCurrent = guard.captureWrite()
  marking.value = true
  try {
    await notifications.markAllRead()
    if (!disposed && isCurrent()) await load()
  } catch (e) {
    if (!disposed && isCurrent()) error.value = e instanceof Error ? e.message : '标记失败，请重试'
  } finally {
    if (!disposed && isCurrent()) marking.value = false
  }
}

watch(
  [unreadOnly, () => auth.session?.token],
  () => {
    guard.reset()
    marking.value = false
    void load()
    void notifications.refresh(true)
  },
  { immediate: true },
)

onBeforeUnmount(() => {
  disposed = true
  version++
  guard.reset()
})
</script>
<template>
  <section class="flex min-h-dvh w-full min-w-0 flex-col bg-base-200/80 dark:bg-base-100">
    <PageHeader title="消息中心" back-label="返回" @back="goBack">
      <template #right>
        <button
          v-if="notifications.unreadCount > 0"
          class="flex min-h-11 items-center gap-1 whitespace-nowrap px-1 text-xs font-medium text-primary disabled:opacity-50"
          type="button"
          :disabled="marking"
          @click="markAll"
        >
          <CheckCheck :size="14" />全部已读
        </button>
      </template>
    </PageHeader>
    <div
      class="flex w-full min-w-0 flex-1 flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(3.75rem+env(safe-area-inset-top))]"
    >
      <div class="flex items-center gap-1.5 pb-2.5">
        <button
          class="ml-auto rounded-full px-3 py-1 text-xs transition-colors"
          :class="
            unreadOnly
              ? 'bg-primary/12 font-semibold text-primary dark:bg-primary/18'
              : 'bg-base-100 font-medium text-base-content/70 active:bg-base-200/60 dark:bg-base-200 dark:active:bg-base-300/50'
          "
          type="button"
          :aria-pressed="unreadOnly"
          @click="unreadOnly = !unreadOnly"
        >
          只看未读
        </button>
      </div>
      <div
        v-if="error"
        role="alert"
        class="mb-2.5 flex items-center justify-between gap-3 rounded-xl bg-error/10 px-3.5 py-2.5 text-xs text-error"
      >
        <p class="min-w-0 flex-1">{{ error }}</p>
        <button
          class="shrink-0 rounded-lg bg-base-100 px-2.5 py-1 text-xs font-medium text-error transition-colors active:opacity-80 disabled:opacity-50 dark:bg-base-200"
          type="button"
          :disabled="loading"
          @click="load()"
        >
          重试
        </button>
      </div>
      <div
        v-if="loading && !items.length"
        class="flex flex-1 flex-col items-center justify-center gap-2.5 pb-[calc(3.5rem+env(safe-area-inset-bottom))] text-center"
        role="status"
        aria-live="polite"
      >
        <span class="loading loading-spinner loading-md text-primary" aria-hidden="true"></span>
        <p class="text-xs font-medium text-base-content/55">正在加载…</p>
      </div>
      <div v-else-if="!error && !items.length" class="rounded-2xl bg-base-100 dark:bg-base-200">
        <EmptyState
          :icon="Bell"
          :title="unreadOnly ? '没有未读消息' : '暂无消息'"
          description="学习消息和系统公告会显示在这里"
          embedded
        />
      </div>
      <div v-for="group in groups" :key="group.label" class="mb-3">
        <p class="mb-2 mt-1 px-0.5 text-xs font-medium text-base-content/55">{{ group.label }}</p>
        <div class="space-y-2">
          <button
            v-for="item in group.items"
            :key="item.id"
            class="flex w-full min-w-0 items-start gap-3 rounded-2xl bg-base-100 px-3.5 py-3 text-left transition-colors active:bg-base-200/60 dark:bg-base-200 dark:active:bg-base-300/50"
            type="button"
            @click="router.push({ name: 'notification-detail', params: { id: item.id } })"
          >
            <span
              class="relative flex size-9 shrink-0 items-center justify-center rounded-xl"
              :class="
                item.category === 'learning'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary/10 text-secondary'
              "
              ><component :is="item.category === 'learning' ? Bell : Megaphone" :size="16" /><span
                v-if="!item.readAt"
                class="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-base-100 bg-error dark:border-base-200"
                aria-label="未读"
              ></span
            ></span>
            <span class="min-w-0 flex-1"
              ><span
                class="block truncate text-sm leading-snug"
                :class="
                  item.readAt
                    ? 'font-medium text-base-content/70'
                    : 'font-semibold text-base-content'
                "
                >{{ item.title }}</span
              ><span
                v-if="preferences.settings?.contentPreview"
                class="mt-0.5 line-clamp-2 block text-xs leading-snug text-base-content/55"
                >{{ item.contentPreview }}</span
              ><span class="mt-1 block text-[11px] text-base-content/55">{{
                notificationTime(item.publishedAt)
              }}</span></span
            >
          </button>
        </div>
      </div>
      <button
        v-if="items.length && page * 20 < total"
        class="mt-1 flex h-10 w-full items-center justify-center gap-1.5 rounded-2xl bg-base-100 text-xs font-medium text-base-content/70 transition-colors active:bg-base-200/60 disabled:opacity-50 dark:bg-base-200 dark:active:bg-base-300/50"
        type="button"
        :disabled="loading"
        @click="load(true)"
      >
        <span v-if="loading" class="loading loading-spinner loading-xs" aria-hidden="true"></span>
        {{ loading ? '加载中…' : '加载更多' }}
      </button>
    </div>
  </section>
</template>
