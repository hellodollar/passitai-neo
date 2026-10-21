<script setup lang="ts">
/**
 * 页签页全屏占位:在页面主体内绝对定位居中,与页头内容无关。
 * 首页/收藏/错题共用,保证各页签的加载态与空态出现在同一位置,切换页签不跳动。
 */
</script>

<template>
  <div
    class="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center"
  >
    <slot></slot>
  </div>
</template>
