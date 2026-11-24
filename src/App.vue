<script setup lang="ts">
import { computed, onBeforeUnmount, watch } from 'vue'
import { useRoute } from 'vue-router'

import AppToast from '@/components/common/AppToast.vue'
import BottomTabBar from '@/components/common/BottomTabBar.vue'
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
  <div v-if="showShell" class="min-h-dvh overflow-x-clip bg-base-100 text-base-content">
    <div
      class="mx-auto min-h-dvh w-full max-w-[32rem] overflow-x-clip bg-base-100 md:border-x md:border-base-content/[0.06] dark:md:border-base-content/[0.08]"
    >
      <main class="min-w-0 overflow-x-clip">
        <RouterView />
      </main>
      <BottomTabBar
        v-if="showTabs"
        class="fixed bottom-0 left-1/2 z-30 w-full max-w-[32rem] -translate-x-1/2 border-t border-base-content/[0.06] bg-base-100/92 px-2.5 pb-[calc(0.35rem+env(safe-area-inset-bottom))] pt-1 backdrop-blur-xl dark:border-base-content/[0.08]"
      />
    </div>
  </div>
  <RouterView v-else />
  <AppToast />
</template>
