<script setup lang="ts">
import { ArrowLeft, Bell, BookOpenCheck, CalendarDays, CheckCheck, Megaphone } from '@lucide/vue'
import { computed, ref, type Component } from 'vue'
import { useRouter } from 'vue-router'

import PageContainer from '@/components/common/PageContainer.vue'
import PagePlaceholder from '@/components/common/PagePlaceholder.vue'

/**
 * 消息中心(静态还原):数据为组件内占位,消息接口落地后由
 * GET /api/notifications(unread-count / read-all)替换;类型已按契约字段命名。
 */
const router = useRouter()

type NotificationCategory = 'learning' | 'system'

interface NotificationItem {
  id: string
  category: NotificationCategory
  /** 展示层字段:按消息子类型选择图标(接口落地后放展示映射) */
  icon: Component
  title: string
  contentPreview: string
  /** 静态占位使用展示文案;接口落地后为 ISO 时间,用 date-fns 格式化 */
  timeLabel: string
  /** 分组用相对天序:0 今天 / 1 昨天 / 2 更早 */
  dayGroup: 0 | 1 | 2
  read: boolean
  linkPath?: string
}

// —— 占位数据(接口就绪后删除) ——
const items = ref<NotificationItem[]>([
  {
    id: 'ntf-exam-1109',
    category: 'learning',
    icon: CalendarDays,
    title: '考试临近提醒',
    contentPreview:
      '你报考省份最近一场考试还有 7 天:中国近现代史纲要,2027-04-11 开考,请合理安排复习。',
    timeLabel: '今天 09:00',
    dayGroup: 0,
    read: false,
    linkPath: '/',
  },
  {
    id: 'ntf-paper-update',
    category: 'learning',
    icon: BookOpenCheck,
    title: '题集更新:中国近现代史纲要',
    contentPreview: '新增 40 道真题,覆盖新文化运动相关考点,欢迎练习。',
    timeLabel: '今天 10:20',
    dayGroup: 0,
    read: false,
    linkPath: '/',
  },
  {
    id: 'ntf-maintenance',
    category: 'system',
    icon: Megaphone,
    title: '系统维护公告',
    contentPreview: '11 月 12 日 02:00–03:00 进行短时维护,期间可能无法访问。',
    timeLabel: '昨天 15:00',
    dayGroup: 1,
    read: true,
  },
  {
    id: 'ntf-daily-1105',
    category: 'learning',
    icon: Bell,
    title: '每日刷题提醒',
    contentPreview: '今天也安排一点刷题时间吧,继续你的学习计划。',
    timeLabel: '11月5日 20:00',
    dayGroup: 2,
    read: true,
  },
])

const categoryLabels: Record<NotificationCategory, string> = { learning: '学习', system: '系统' }

type CategoryFilter = 'all' | NotificationCategory

const categoryFilter = ref<CategoryFilter>('all')
const unreadOnly = ref(false)

const unreadCount = computed(() => items.value.filter((item) => !item.read).length)
const unreadByCategory = computed(() => {
  const counts: Record<CategoryFilter, number> = { all: 0, learning: 0, system: 0 }
  for (const item of items.value) {
    if (!item.read) {
      counts.all++
      counts[item.category]++
    }
  }
  return counts
})

const visibleItems = computed(() => {
  const dayGroups = [0, 1, 2] as const
  const groups: Array<{ label: string; items: NotificationItem[] }> = []
  for (const dayGroup of dayGroups) {
    const matched = items.value.filter(
      (item) =>
        item.dayGroup === dayGroup &&
        (categoryFilter.value === 'all' || item.category === categoryFilter.value) &&
        (!unreadOnly.value || !item.read),
    )
    if (matched.length === 0) continue
    groups.push({
      label: dayGroup === 0 ? '今天' : dayGroup === 1 ? '昨天' : '更早',
      items: matched,
    })
  }
  return groups
})

const hasVisibleItems = computed(() => visibleItems.value.length > 0)

function markAllRead() {
  if (unreadCount.value === 0) return
  items.value = items.value.map((item) => ({ ...item, read: true }))
}

function openDetail(item: NotificationItem) {
  // 接口落地后:先 GET /:id 再跳转;静态阶段直接携带占位 id。
  void router.push({ name: 'notification-detail', params: { id: item.id } })
}
</script>

<template>
  <PageContainer>
    <section class="flex w-full min-w-0 flex-col">
      <header class="grid h-11 shrink-0 grid-cols-[40px_minmax(0,1fr)_auto] items-center">
        <button
          class="flex size-10 items-center justify-center rounded-full text-base-content transition active:bg-base-200"
          type="button"
          aria-label="返回"
          @click="router.back()"
        >
          <ArrowLeft :size="20" />
        </button>
        <h1 class="truncate text-center text-[15px] font-semibold">消息中心</h1>
        <button
          v-if="unreadCount > 0"
          class="flex items-center gap-1 text-xs text-primary transition-opacity active:opacity-70"
          type="button"
          @click="markAllRead"
        >
          <CheckCheck :size="14" />
          全部已读
        </button>
      </header>

      <div class="flex items-center gap-1.5 pb-2">
        <button
          v-for="option in [
            { value: 'all' as const, label: '全部' },
            { value: 'learning' as const, label: categoryLabels.learning },
            { value: 'system' as const, label: categoryLabels.system },
          ]"
          :key="option.value"
          class="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
          :class="
            categoryFilter === option.value
              ? 'bg-primary text-primary-content'
              : 'bg-base-200/60 text-base-content/60 active:bg-base-200'
          "
          type="button"
          :aria-pressed="categoryFilter === option.value"
          @click="categoryFilter = option.value"
        >
          {{ option.label }}
          <span
            v-if="unreadByCategory[option.value] > 0"
            class="text-[10px] opacity-75 tabular-nums"
          >
            {{ unreadByCategory[option.value] }}
          </span>
        </button>
        <button
          class="ml-auto flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors"
          :class="
            unreadOnly
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-base-200 bg-base-100 text-base-content/60 active:bg-base-200/60'
          "
          type="button"
          :aria-pressed="unreadOnly"
          @click="unreadOnly = !unreadOnly"
        >
          只看未读
        </button>
      </div>

      <PagePlaceholder v-if="!hasVisibleItems">
        <span
          class="flex size-[52px] items-center justify-center rounded-full bg-primary/10 text-primary"
        >
          <Bell :size="24" />
        </span>
        <h2 class="mt-3.5 text-[15px] font-semibold">
          {{ unreadOnly ? '没有未读消息' : '暂无消息' }}
        </h2>
        <p class="mt-2 text-[13px] text-base-content/65">
          有新的考试安排或题集更新时会在这里通知你
        </p>
      </PagePlaceholder>

      <template v-else>
        <div v-for="group in visibleItems" :key="group.label" class="mb-2">
          <p class="mb-1.5 mt-3 px-1 text-xs font-semibold text-base-content/45">
            {{ group.label }}
          </p>
          <button
            v-for="item in group.items"
            :key="item.id"
            class="group flex w-full min-w-0 items-start gap-2.5 rounded-xl border bg-base-100 px-3 py-2.5 text-left transition active:bg-base-200/50"
            :class="item.read ? 'border-base-200' : 'border-primary/20 bg-primary/[0.03]'"
            type="button"
            @click="openDetail(item)"
          >
            <span
              class="relative flex size-[34px] shrink-0 items-center justify-center rounded-lg"
              :class="
                item.category === 'learning'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-secondary/10 text-secondary'
              "
            >
              <component :is="item.icon" :size="16" />
              <span
                v-if="!item.read"
                class="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-base-100 bg-error"
                aria-hidden="true"
              ></span>
            </span>
            <span class="min-w-0 flex-1">
              <span
                class="block truncate text-[13.5px]"
                :class="item.read ? 'font-medium text-base-content/75' : 'font-semibold'"
              >
                {{ item.title }}
              </span>
              <span
                class="mt-0.5 line-clamp-2 block text-xs leading-snug"
                :class="item.read ? 'text-base-content/45' : 'text-base-content/65'"
              >
                {{ item.contentPreview }}
              </span>
              <span class="mt-1 block text-[11px] text-base-content/45">{{ item.timeLabel }}</span>
            </span>
          </button>
        </div>
      </template>
    </section>
  </PageContainer>
</template>
