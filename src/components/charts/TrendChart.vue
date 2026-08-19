<script setup lang="ts">
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = defineProps<{
  values: number[]
  labels?: string[]
  max?: number
}>()

const chartEl = ref<HTMLElement | null>(null)
let chart: uPlot | null = null

function chartData(): uPlot.AlignedData {
  return [props.values.map((_, index) => index + 1), props.values] as uPlot.AlignedData
}

function buildChart() {
  if (!chartEl.value || props.values.length === 0) return

  chart?.destroy()

  const yMax = props.max ?? Math.max(100, ...props.values, 1)
  const labels = props.labels ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  chart = new uPlot(
    {
      width: chartEl.value.clientWidth || 320,
      height: 180,
      padding: [12, 8, 0, 0],
      cursor: { show: false },
      legend: { show: false },
      scales: {
        x: { time: false },
        y: { range: [0, yMax] },
      },
      axes: [
        {
          stroke: 'oklch(45% 0.02 258)',
          grid: { stroke: 'transparent' },
          values: (_, ticks) =>
            ticks.map((tick) => labels[Math.round(tick) - 1] ?? `${tick}`),
        },
        {
          stroke: 'oklch(45% 0.02 258)',
          grid: { stroke: 'oklch(91% 0.012 106)' },
          values: (_, ticks) => ticks.map((tick) => `${tick}`),
        },
      ],
      series: [
        {},
        {
          stroke: 'oklch(63% 0.18 153)',
          width: 3,
          fill: 'oklch(63% 0.18 153 / 0.14)',
          points: { show: true, size: 7, stroke: 'oklch(63% 0.18 153)', fill: 'white' },
        },
      ],
    },
    chartData(),
    chartEl.value,
  )
}

function resizeChart() {
  if (!chart || !chartEl.value) return
  chart.setSize({ width: chartEl.value.clientWidth || 320, height: 180 })
}

onMounted(() => {
  buildChart()
  window.addEventListener('resize', resizeChart)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resizeChart)
  chart?.destroy()
})

watch(() => props.values, buildChart, { deep: true })
</script>

<template>
  <div ref="chartEl" class="min-h-44 w-full"></div>
</template>
