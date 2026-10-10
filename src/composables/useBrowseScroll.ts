import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { onBeforeRouteLeave, useRoute } from 'vue-router'

import { readBrowseState, writeBrowseState, type BrowsePage } from '@/utils/browse-state'

/** 列表加载后再恢复位置，避免异步内容尚未撑开时被浏览器截断。 */
export function useBrowseScroll(userId: () => string, page: () => BrowsePage) {
  const route = useRoute()
  let disposed = false
  let restoreVersion = 0
  let restored = false

  function capture() {
    // 尚未恢复的加载页不能用临时高度覆盖原列表位置。
    if (restored) writeBrowseState(userId(), page(), { scrollTop: window.scrollY })
  }

  function reset() {
    restored = false
    restoreVersion++
  }

  async function restore() {
    if (restored) return
    const version = ++restoreVersion
    const account = userId()
    const source = page()
    const path = route.path
    const top = readBrowseState(account, source).scrollTop
    await nextTick()
    await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()))
    if (
      disposed ||
      version !== restoreVersion ||
      account !== userId() ||
      source !== page() ||
      path !== route.path
    )
      return
    window.scrollTo({ top, left: 0, behavior: 'instant' })
    restored = true
  }

  onBeforeRouteLeave(capture)
  onMounted(() => window.addEventListener('pagehide', capture))
  onBeforeUnmount(() => {
    disposed = true
    window.removeEventListener('pagehide', capture)
  })
  return { capture, restore, reset }
}
