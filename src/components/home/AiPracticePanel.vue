<script setup lang="ts">
import { ChevronRight, Clock3, List, Play, RefreshCw, Sparkles, WandSparkles } from '@lucide/vue'
import { computed } from 'vue'

/**
 * AI 练习面板(静态还原):当前为纯占位 UI,数据写死在下方,
 * AI 训练接口落地后由 store 提供同构数据并接通「开始练习 / 换一份 / 自定义生成」。
 */
const props = defineProps<{ subjectName: string }>()

/** 占位类型:字段命名对齐未来接口契约,届时迁移到 types/practice.ts。 */
interface AiRecommendation {
  title: string
  basisSummary: string
  knowledgePoints: string[]
  questionCount: number
  estimatedMinutes: number
  updatedAtLabel: string
}

interface AiTrainingHistoryItem {
  name: string
  questionCount: number
  dateLabel: string
  /** 已练显示正确率,未练为 null */
  accuracy: number | null
}

// —— 占位数据(接口就绪后删除) ——
const recommendation = computed<AiRecommendation>(() => ({
  title: '薄弱点特训:辛亥革命与五四运动',
  basisSummary: `近 7 天「${props.subjectName}」错题 12 道,错误集中在下面 2 个考点`,
  knowledgePoints: ['辛亥革命的历史意义', '新文化运动'],
  questionCount: 10,
  estimatedMinutes: 8,
  updatedAtLabel: '更新于 今天 14:30',
}))

const history = computed<AiTrainingHistoryItem[]>(() => [
  { name: '综合模拟:资产阶级革命与共和制度', questionCount: 10, dateLabel: '昨天', accuracy: 86 },
  { name: '错题变式:新文化运动代表人物', questionCount: 5, dateLabel: '周四', accuracy: null },
  { name: '薄弱点特训:马克思主义的传播', questionCount: 10, dateLabel: '10月28日', accuracy: 72 },
])
</script>

<template>
  <div class="border-t border-base-200 px-4 py-3">
    <div class="rounded-2xl border border-base-200 bg-base-100 p-4">
      <div class="flex items-center gap-2">
        <span
          class="flex size-7.5 shrink-0 items-center justify-center rounded-full bg-ai/10 text-ai"
        >
          <Sparkles :size="16" />
        </span>
        <span class="rounded-full bg-ai/10 px-2 py-0.5 text-[11px] font-semibold text-ai"
          >AI 推荐</span
        >
      </div>

      <h3 class="mt-2.5 text-[15px] font-semibold">{{ recommendation.title }}</h3>
      <p class="mt-1.5 text-xs leading-relaxed text-base-content/65">
        依据:<b class="font-semibold text-base-content">{{ recommendation.basisSummary }}</b>
      </p>
      <div class="mt-2 flex flex-wrap gap-1.5">
        <span
          v-for="point in recommendation.knowledgePoints"
          :key="point"
          class="rounded-full bg-base-200/70 px-2 py-0.5 text-[11px] text-base-content/60"
        >
          {{ point }}
        </span>
      </div>
      <div class="mt-3 flex items-center gap-1.5 text-xs text-base-content/45">
        <List :size="12" />
        <span class="tabular-nums">{{ recommendation.questionCount }} 题</span>
        <span aria-hidden="true">·</span>
        <Clock3 :size="12" />
        <span>约 {{ recommendation.estimatedMinutes }} 分钟</span>
        <span aria-hidden="true">·</span>
        <span>{{ recommendation.updatedAtLabel }}</span>
      </div>

      <div class="mt-3.5 flex gap-2">
        <button
          class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-sm font-medium text-primary-content transition-opacity active:opacity-80"
          type="button"
        >
          <Play :size="15" />
          开始练习
        </button>
        <button
          class="flex size-10 items-center justify-center rounded-xl border border-base-200 bg-base-100 text-base-content/60 transition-colors active:bg-base-200/60"
          type="button"
          aria-label="换一份"
        >
          <RefreshCw :size="15" />
        </button>
      </div>
    </div>

    <button
      class="mt-3 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-ai/40 bg-ai/10 text-[13px] font-medium text-ai transition-opacity active:opacity-80"
      type="button"
    >
      <WandSparkles :size="14" />
      自定义生成
    </button>

    <div class="mt-3.5 flex items-center justify-between px-0.5">
      <span class="text-[13px] font-semibold">最近的 AI 训练</span>
      <button class="text-xs text-base-content/45" type="button">全部</button>
    </div>
    <div class="mt-2 space-y-2">
      <button
        v-for="item in history"
        :key="item.name"
        class="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-base-200 bg-base-100 px-3 py-2.5 text-left transition active:bg-base-200/50"
        type="button"
      >
        <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-ai/10 text-ai">
          <Sparkles :size="16" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-[13px] font-medium">{{ item.name }}</span>
          <span class="mt-0.5 block text-[11px] text-base-content/45">
            {{ item.questionCount }} 题 · {{ item.dateLabel }}
          </span>
        </span>
        <span
          v-if="item.accuracy !== null"
          class="shrink-0 text-sm font-semibold text-success tabular-nums"
        >
          {{ item.accuracy }}%
        </span>
        <span v-else class="shrink-0 text-xs text-base-content/45">未开始</span>
        <ChevronRight :size="16" class="shrink-0 text-base-content/30" />
      </button>
    </div>
  </div>
</template>
