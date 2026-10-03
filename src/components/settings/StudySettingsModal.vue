<script setup lang="ts">
import { computed } from 'vue'

import BaseModal from '@/components/common/BaseModal.vue'
import FavoritesSettingsSection from '@/components/settings/FavoritesSettingsSection.vue'
import PracticeSettingsSection from '@/components/settings/PracticeSettingsSection.vue'
import WrongQuestionsSettingsSection from '@/components/settings/WrongQuestionsSettingsSection.vue'
import type { PracticeSettings } from '@/types/domain'

export type SettingsSection = 'practice' | 'favorites' | 'wrongQuestions'

const model = defineModel<boolean>({ default: false })

const props = withDefaults(
  defineProps<{
    /** 指定时只展示对应域的设置;缺省为聚合模式(刷题/收藏/错题分组展示) */
    section?: SettingsSection
    /** 外部聚合数据(如 /api/me 的 preferences.practice),透传给刷题设置节 */
    settings?: PracticeSettings | null
  }>(),
  {
    section: undefined,
    settings: null,
  },
)

const emit = defineEmits<{
  saved: [settings: PracticeSettings]
}>()

const SECTION_TITLES: Record<SettingsSection, string> = {
  practice: '刷题设置',
  favorites: '收藏设置',
  wrongQuestions: '错题设置',
}

const isAggregate = computed(() => !props.section)
const title = computed(() => (isAggregate.value ? '练习设置' : SECTION_TITLES[props.section!]))
</script>

<template>
  <BaseModal v-model="model" :title="title">
    <!-- 聚合模式:三节分组滚动展示 -->
    <div v-if="isAggregate" class="grid gap-5">
      <PracticeSettingsSection :active="model" show-header :settings="settings" @saved="emit('saved', $event)" />
      <FavoritesSettingsSection show-header />
      <WrongQuestionsSettingsSection show-header />
    </div>

    <!-- 单节模式:只展示对应域 -->
    <PracticeSettingsSection
      v-else-if="section === 'practice'"
      :active="model"
      :settings="settings"
      @saved="emit('saved', $event)"
    />
    <FavoritesSettingsSection v-else-if="section === 'favorites'" />
    <WrongQuestionsSettingsSection v-else />
  </BaseModal>
</template>
