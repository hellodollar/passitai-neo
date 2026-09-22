import { ref } from 'vue'

export type ToastType = 'error' | 'success'

export type ToastItem = {
  id: number
  type: ToastType
  message: string
}

const toasts = ref<ToastItem[]>([])
let sequence = 0

export function useToasts() {
  return toasts
}

export function dismissToast(id: number) {
  toasts.value = toasts.value.filter((toast) => toast.id !== id)
}

function showToast(type: ToastType, message: string, duration = 3000) {
  const id = ++sequence
  toasts.value = [...toasts.value, { id, type, message }]
  setTimeout(() => dismissToast(id), duration)
}

export function showErrorToast(message: string, duration = 3000) {
  showToast('error', message, duration)
}

export function showSuccessToast(message: string, duration = 3000) {
  showToast('success', message, duration)
}
