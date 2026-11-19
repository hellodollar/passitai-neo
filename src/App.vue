<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

import BottomTabBar from '@/components/BottomTabBar.vue'
import AppToast from '@/components/common/AppToast.vue'
import { useAuthStore } from '@/stores/auth'
import { useNotificationSettingsStore } from '@/stores/notification-settings'
import { useNotificationsStore } from '@/stores/notifications'

const route = useRoute()
const auth = useAuthStore()
const notifications = useNotificationsStore()
const notificationSettings = useNotificationSettingsStore()
watch(
  () => auth.session?.token,
  () => {
    if (auth.isAuthenticated) {
      notifications.start()
      void notificationSettings.load()
    } else {
      notifications.reset()
      notificationSettings.reset()
    }
  },
  { immediate: true },
)
onBeforeUnmount(notifications.stop)
const showShell = computed(
  () => route.name && !['login', 'register', 'not-found'].includes(String(route.name)),
)
const showTabs = computed(() =>
  ['home', 'favorites', 'mistakes', 'me'].includes(String(route.name)),
)
</script>

<template>
  <div v-if="showShell" class="min-h-dvh overflow-x-hidden bg-base-100 text-base-content">
    <div
      class="mx-auto min-h-dvh w-full max-w-[32rem] overflow-x-hidden bg-base-100 md:border-x md:border-base-300"
    >
      <main class="min-w-0 overflow-x-hidden">
        <RouterView />
      </main>
      <BottomTabBar
        v-if="showTabs"
        class="fixed bottom-0 left-1/2 z-30 w-full max-w-[32rem] -translate-x-1/2 bg-base-100/92 px-2.5 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1 ring-1 ring-base-content/6 backdrop-blur-xl"
      />
    </div>
  </div>
  <RouterView v-else />
  <AppToast />
</template>
