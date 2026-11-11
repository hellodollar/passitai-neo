<script setup lang="ts">
import { ArrowLeft, BookOpenCheck, CalendarDays } from '@lucide/vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PageContainer from '@/components/common/PageContainer.vue'

/**
 * 消息详情(静态还原):占位内容按 id 匹配,接口落地后由
 * GET /api/notifications/:id 提供(打开成功后调用 :id/read 标已读)。
 */
const route = useRoute()
const router = useRouter()

interface NotificationDetail {
  id: string
  category: 'learning' | 'system'
  categoryLabel: string
  title: string
  /** 首版正文为纯文本 + 换行 */
  content: string
  timeLabel: string
  linkPath?: string
  /** 站内入口按钮文案;有 linkPath 时必填 */
  ctaLabel?: string
}

// —— 占位数据(接口就绪后删除) ——
const details: NotificationDetail[] = [
  {
    id: 'ntf-exam-1109',
    category: 'learning',
    categoryLabel: '学习提醒',
    title: '考试临近提醒:中国近现代史纲要还有 7 天开考',
    content:
      '你报考的广东省最近一场考试临近:\n\n中国近现代史纲要\n考试时间:2027-04-11(2027 年第 04 期)\n距离考试还有 7 天\n\n请合理安排复习时间,以官方发布的考试安排为准。',
    timeLabel: '今天 09:00',
    linkPath: '/',
    ctaLabel: '查看刷题计划',
  },
  {
    id: 'ntf-paper-update',
    category: 'learning',
    categoryLabel: '学习消息',
    title: '题集更新:中国近现代史纲要',
    content: '《中国近现代史纲要》新增 40 道真题,覆盖新文化运动相关考点,欢迎练习。',
    timeLabel: '今天 10:20',
    linkPath: '/',
    ctaLabel: '去练习',
  },
  {
    id: 'ntf-maintenance',
    category: 'system',
    categoryLabel: '系统公告',
    title: '系统维护公告',
    content: '11 月 12 日 02:00–03:00 进行短时维护,期间可能无法访问,请提前保存作答进度。',
    timeLabel: '昨天 15:00',
  },
  {
    id: 'ntf-daily-1105',
    category: 'learning',
    categoryLabel: '学习提醒',
    title: '每日刷题提醒',
    content: '今天也安排一点刷题时间吧,继续你的学习计划。',
    timeLabel: '11月5日 20:00',
  },
]

const detail = computed(() => details.find((item) => item.id === route.params.id) ?? details[0]!)

function openLink() {
  const path = detail.value.linkPath
  if (path) void router.push(path)
}
</script>

<template>
  <PageContainer>
    <section class="flex w-full min-w-0 flex-col">
      <header class="grid h-11 shrink-0 grid-cols-[40px_minmax(0,1fr)_40px] items-center">
        <button
          class="flex size-10 items-center justify-center rounded-full text-base-content transition active:bg-base-200"
          type="button"
          aria-label="返回"
          @click="router.back()"
        >
          <ArrowLeft :size="20" />
        </button>
        <h1 class="truncate text-center text-[15px] font-semibold">消息详情</h1>
        <span aria-hidden="true"></span>
      </header>

      <div class="mt-1 flex items-center gap-2">
        <span
          class="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          :class="
            detail.category === 'learning'
              ? 'bg-primary/10 text-primary'
              : 'bg-secondary/10 text-secondary'
          "
        >
          {{ detail.categoryLabel }}
        </span>
        <span class="text-xs text-base-content/45">{{ detail.timeLabel }}</span>
      </div>

      <h2 class="mt-3 text-[17px] font-semibold leading-snug">{{ detail.title }}</h2>

      <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-base-content/70">
        {{ detail.content }}
      </p>

      <div
        v-if="detail.linkPath"
        class="mt-6 rounded-2xl border border-base-200 bg-base-100 p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
      >
        <button
          class="btn btn-primary h-11 min-h-11 w-full rounded-xl text-sm"
          type="button"
          @click="openLink"
        >
          <CalendarDays v-if="detail.ctaLabel === '查看刷题计划'" :size="16" aria-hidden="true" />
          <BookOpenCheck v-else :size="16" aria-hidden="true" />
          {{ detail.ctaLabel }}
        </button>
      </div>
    </section>
  </PageContainer>
</template>
