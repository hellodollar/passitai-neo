/** 让键盘焦点在当前弹出层内循环，跳过隐藏和禁用的控件。 */
export function trapOverlayFocus(event: KeyboardEvent, container: HTMLElement | null) {
  const elements = container?.querySelectorAll<HTMLElement>(
    'button, input:not([type="hidden"]), select, textarea, a[href], [tabindex]',
  )
  const focusable = Array.from(elements ?? []).filter(
    (element) =>
      element.tabIndex >= 0 &&
      !element.matches(':disabled, [hidden], [aria-hidden="true"]') &&
      element.getClientRects().length > 0,
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) {
    event.preventDefault()
    container?.focus({ preventScroll: true })
    return
  }
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === container)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && (active === last || active === container)) {
    event.preventDefault()
    first.focus()
  }
}

/** 新弹层已获得焦点时，关闭的旧弹层不再把焦点抢回页面。 */
export function restoreOverlayFocus(previousFocus: HTMLElement | null) {
  const active = document.activeElement
  if (previousFocus?.isConnected && (active === document.body || !active?.isConnected)) {
    previousFocus.focus({ preventScroll: true })
  }
}
