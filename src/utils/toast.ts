import { ref } from 'vue'

export type ToastItem = {
  id: number
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

export function showErrorToast(message: string, duration = 3000) {
  const id = ++sequence
  toasts.value = [...toasts.value, { id, message }]
  setTimeout(() => dismissToast(id), duration)
}
