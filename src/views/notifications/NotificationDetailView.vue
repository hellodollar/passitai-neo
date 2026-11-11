<script setup lang="ts">
import { ArrowLeft, BookOpenCheck } from '@lucide/vue'
import { onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { ApiError } from '@/api/http'
import { fetchNotification } from '@/api/notifications'
import { useAuthStore } from '@/stores/auth'
import { useNotificationsStore } from '@/stores/notifications'
import type { NotificationDetail } from '@/types/notification'
import { notificationTime } from '@/utils/notifications'
import { createSessionGuard } from '@/utils/session-guard'

const route = useRoute(),
  router = useRouter(),
  auth = useAuthStore(),
  notifications = useNotificationsStore()
const detail = ref<NotificationDetail | null>(null),
  loading = ref(false),
  error = ref(''),
  readError = ref(''),
  reading = ref(false)
let version = 0,
  disposed = false
const guard = createSessionGuard()
async function markRead() {
  if (!detail.value || detail.value.readAt || reading.value) return
  const id = detail.value.id,
    current = version,
    isCurrent = guard.captureWrite()
  reading.value = true
  readError.value = ''
  try {
    const result = await notifications.markRead(id)
    if (!disposed && current === version && isCurrent() && detail.value?.id === id) {
      detail.value.readAt = result.readAt
    }
  } catch (e) {
    if (disposed || current !== version || !isCurrent()) return
    if (e instanceof ApiError && e.status === 404) {
      detail.value = null
      error.value = '消息不存在或已撤下'
      void notifications.refresh(true)
    } else {
      readError.value = '已读状态未保存，请重试'
    }
  } finally {
    if (!disposed && current === version) reading.value = false
  }
}
async function load() {
  const current = ++version,
    isCurrent = guard.captureRead()
  detail.value = null
  loading.value = true
  error.value = ''
  readError.value = ''
  reading.value = false
  try {
    const next = await fetchNotification(String(route.params.id))
    if (disposed || current !== version || !isCurrent()) return
    detail.value = next
    void markRead()
  } catch (e) {
    if (!disposed && current === version && isCurrent()) {
      error.value = e instanceof Error ? e.message : '消息获取失败'
      void notifications.refresh(true)
    }
  } finally {
    if (!disposed && current === version) loading.value = false
  }
}
watch(
  [() => route.params.id, () => auth.session?.token],
  () => {
    guard.reset()
    void load()
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
      <div class="grid h-14 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 px-3">
        <button
          class="flex size-10 items-center justify-center rounded-full text-base-content transition active:bg-base-200"
          type="button"
          aria-label="返回"
          @click="router.back()"
        >
          <ArrowLeft :size="21" />
        </button>
        <h1 class="truncate text-center text-[15px] font-semibold leading-tight">消息详情</h1>
        <span aria-hidden="true"></span>
      </div>
    </header>
    <div
      class="flex w-full min-w-0 flex-1 flex-col px-5 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-[calc(4.25rem+env(safe-area-inset-top))]"
    >
      <div class="flex flex-col items-center gap-3 py-16 text-center" v-if="loading">
        <span class="loading loading-spinner loading-sm"></span>
        <p role="status">正在获取消息…</p>
      </div>
      <div class="flex flex-col items-center gap-3 py-16 text-center" v-else-if="error">
        <p role="alert">{{ error }}</p>
        <button type="button" class="btn btn-ghost btn-sm" @click="load">重新获取</button>
      </div>
      <template v-else-if="detail">
        <div class="mt-1 flex items-center gap-2">
          <span
            class="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary"
            >{{ detail.category === 'learning' ? '学习消息' : '系统公告' }}</span
          ><span class="text-xs text-base-content/45">{{
            notificationTime(detail.publishedAt)
          }}</span>
        </div>
        <h2 class="mt-3 break-words text-[17px] font-semibold leading-snug">{{ detail.title }}</h2>
        <p
          class="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-base-content/70"
        >
          {{ detail.content }}
        </p>
        <p v-if="readError" class="mt-3 text-xs text-error" role="alert">
          {{ readError
          }}<button class="ml-2 underline" :disabled="reading" type="button" @click="markRead">
            重试
          </button>
        </p>
        <button
          v-if="detail.linkPath"
          class="btn btn-primary mt-6 h-11 min-h-11 w-full rounded-xl text-sm"
          type="button"
          @click="router.push(detail.linkPath)"
        >
          <BookOpenCheck :size="16" />{{ detail.linkPath === '/' ? '前往首页' : '查看题集' }}
        </button>
      </template>
    </div>
  </section>
</template>
