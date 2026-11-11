<script setup lang="ts">
import { ArrowLeft, Bell, CheckCheck, Megaphone } from '@lucide/vue'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { fetchNotifications } from '@/api/notifications'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationItem } from '@/types/notification'
import { notificationDayGroup, notificationTime } from '@/utils/notifications'
import { createSessionGuard } from '@/utils/session-guard'

const router = useRouter(),
  auth = useAuthStore(),
  notifications = useNotificationsStore()
const items = ref<NotificationItem[]>([]),
  total = ref(0),
  page = ref(1),
  loading = ref(false),
  marking = ref(false),
  error = ref('')
const category = ref<'all' | NotificationItem['category']>('all'),
  unreadOnly = ref(false)
const options = [
  { value: 'all', label: '全部' },
  { value: 'learning', label: '学习' },
  { value: 'system', label: '系统' },
] as const
const counts = computed(() => ({
  all: notifications.unreadCount,
  learning: notifications.summary?.unreadByCategory.learning ?? 0,
  system: notifications.summary?.unreadByCategory.system ?? 0,
}))
const groups = computed(() =>
  ['今天', '昨天', '更早']
    .map((label) => ({
      label,
      items: items.value.filter((item) => notificationDayGroup(item.publishedAt) === label),
    }))
    .filter((group) => group.items.length),
)
const guard = createSessionGuard()
let version = 0,
  disposed = false
async function load(append = false) {
  const current = ++version,
    isCurrent = guard.captureRead(),
    targetPage = append ? page.value + 1 : 1
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
      category: category.value === 'all' ? undefined : category.value,
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
  [category, unreadOnly, () => auth.session?.token],
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
  <section class="flex min-h-dvh w-full min-w-0 flex-col">
    <header
      class="fixed left-1/2 top-0 z-40 w-full max-w-[32rem] -translate-x-1/2 border-b border-base-200/80 bg-base-100/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl"
    >
      <div
        class="relative grid h-14 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3"
      >
        <button
          class="flex size-10 items-center justify-center rounded-full text-base-content transition active:bg-base-200"
          type="button"
          aria-label="返回"
          @click="router.back()"
        >
          <ArrowLeft :size="21" />
        </button>
        <h1 class="truncate text-center text-[15px] font-semibold leading-tight">消息中心</h1>
        <button
          v-if="notifications.unreadCount > 0"
          class="flex items-center gap-1 whitespace-nowrap pr-1 text-xs text-primary disabled:opacity-50"
          type="button"
          :disabled="marking"
          @click="markAll"
        >
          <CheckCheck :size="14" />全部已读
        </button>
      </div>
    </header>
    <div
      class="flex w-full min-w-0 flex-1 flex-col px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(4.5rem+env(safe-area-inset-top))]"
    >
      <div class="flex items-center gap-1.5 pb-2">
        <button
          v-for="option in options"
          :key="option.value"
          class="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium"
          :class="
            category === option.value
              ? 'bg-primary text-primary-content'
              : 'bg-base-200/60 text-base-content/60'
          "
          type="button"
          :aria-pressed="category === option.value"
          @click="category = option.value"
        >
          {{ option.label
          }}<span v-if="counts[option.value]" class="text-[10px] opacity-75 tabular-nums">{{
            counts[option.value]
          }}</span>
        </button>
        <button
          class="ml-auto rounded-full border px-2.5 py-1 text-xs"
          :class="
            unreadOnly
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-base-200 text-base-content/60'
          "
          type="button"
          :aria-pressed="unreadOnly"
          @click="unreadOnly = !unreadOnly"
        >
          只看未读
        </button>
      </div>
      <div v-if="error" role="alert" class="rounded-xl border border-error/30 p-3 text-sm">
        <p>{{ error }}</p>
        <button class="btn btn-ghost btn-sm mt-1" type="button" :disabled="loading" @click="load()">
          重试
        </button>
      </div>
      <div
        class="flex flex-col items-center gap-3 py-16 text-center"
        v-if="loading && !items.length"
      >
        <span class="loading loading-spinner loading-sm"></span>
        <p role="status">正在获取消息…</p>
      </div>
      <div
        class="flex flex-col items-center gap-3 py-16 text-center"
        v-else-if="!error && !items.length"
      >
        <Bell :size="24" class="text-primary" />
        <h2 class="mt-3 text-[15px] font-semibold">
          {{ unreadOnly ? '没有未读消息' : '暂无消息' }}
        </h2>
        <p class="mt-2 text-[13px] text-base-content/65">学习消息和系统公告会显示在这里</p>
      </div>
      <div v-for="group in groups" :key="group.label" class="mb-2">
        <p class="mb-1.5 mt-3 px-1 text-xs font-semibold text-base-content/45">{{ group.label }}</p>
        <button
          v-for="item in group.items"
          :key="item.id"
          class="mb-1.5 flex w-full min-w-0 items-start gap-2.5 rounded-xl border px-3 py-2.5 text-left active:bg-base-200/50"
          :class="
            item.readAt ? 'border-base-200 bg-base-100' : 'border-primary/20 bg-primary/[0.03]'
          "
          type="button"
          @click="router.push({ name: 'notification-detail', params: { id: item.id } })"
        >
          <span
            class="relative flex size-[34px] shrink-0 items-center justify-center rounded-lg"
            :class="
              item.category === 'learning'
                ? 'bg-primary/10 text-primary'
                : 'bg-secondary/10 text-secondary'
            "
            ><component :is="item.category === 'learning' ? Bell : Megaphone" :size="16" /><span
              v-if="!item.readAt"
              class="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-base-100 bg-error"
              aria-label="未读"
            ></span
          ></span>
          <span class="min-w-0 flex-1"
            ><span
              class="block truncate text-[13.5px]"
              :class="item.readAt ? 'font-medium text-base-content/75' : 'font-semibold'"
              >{{ item.title }}</span
            ><span class="mt-0.5 line-clamp-2 block text-xs leading-snug text-base-content/65">{{
              item.contentPreview
            }}</span
            ><span class="mt-1 block text-[11px] text-base-content/45">{{
              notificationTime(item.publishedAt)
            }}</span></span
          >
        </button>
      </div>
      <button
        v-if="items.length && page * 20 < total"
        class="btn btn-ghost btn-sm mb-4"
        type="button"
        :disabled="loading"
        @click="load(true)"
      >
        {{ loading ? '正在获取…' : '加载更多' }}
      </button>
    </div>
  </section>
</template>
