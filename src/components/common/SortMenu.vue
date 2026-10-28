<script setup lang="ts">
import { ArrowDownUp, Check } from '@lucide/vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, useId, watch } from 'vue'

const props = defineProps<{
  modelValue: string
  options: ReadonlyArray<{ value: string; label: string }>
  loading?: boolean
}>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const menuId = useId()
const menuRef = ref<HTMLElement | null>(null)
const buttonRef = ref<HTMLButtonElement | null>(null)
const optionsRef = ref<HTMLElement | null>(null)
const open = ref(false)
const focusedIndex = ref(0)
const selectedLabel = computed(
  () => props.options.find((option) => option.value === props.modelValue)?.label ?? '排序',
)

function closeMenu(restoreFocus = false) {
  open.value = false
  if (restoreFocus) buttonRef.value?.focus()
}

function focusOption(index: number) {
  const buttons = optionsRef.value?.querySelectorAll<HTMLButtonElement>('button')
  if (!buttons?.length) return
  focusedIndex.value = (index + buttons.length) % buttons.length
  buttons[focusedIndex.value]?.focus()
}

async function openMenu(position: 'selected' | 'first' | 'last' = 'selected') {
  if (props.loading || props.options.length === 0) return
  const selectedIndex = props.options.findIndex((option) => option.value === props.modelValue)
  focusedIndex.value =
    position === 'first'
      ? 0
      : position === 'last'
        ? props.options.length - 1
        : Math.max(0, selectedIndex)
  open.value = true
  await nextTick()
  if (open.value) focusOption(focusedIndex.value)
}

function toggleMenu() {
  if (open.value) closeMenu()
  else void openMenu()
}

function selectOption(value: string) {
  closeMenu(true)
  if (!props.loading) emit('update:modelValue', value)
}

function handleKeydown(event: KeyboardEvent) {
  const destinations: Record<string, number> = {
    ArrowDown: focusedIndex.value + 1,
    ArrowUp: focusedIndex.value - 1,
    Home: 0,
    End: props.options.length - 1,
  }
  const index = destinations[event.key]
  if (index === undefined) return
  event.preventDefault()
  focusOption(index)
}

function handleFocusOut(event: FocusEvent) {
  if (!(event.relatedTarget instanceof Node) || !menuRef.value?.contains(event.relatedTarget)) {
    closeMenu()
  }
}

function handleOutsideClick(event: PointerEvent) {
  if (event.target instanceof Node && !menuRef.value?.contains(event.target)) closeMenu()
}

watch([() => props.modelValue, () => props.loading], () => closeMenu())
onMounted(() => document.addEventListener('pointerdown', handleOutsideClick))
onBeforeUnmount(() => document.removeEventListener('pointerdown', handleOutsideClick))
</script>

<template>
  <div
    ref="menuRef"
    class="relative justify-self-end"
    @focusout="handleFocusOut"
    @keydown.esc.stop.prevent="closeMenu(true)"
  >
    <button
      ref="buttonRef"
      class="flex h-10 items-center gap-1 rounded-lg pl-2 text-[13px] text-base-content/65 transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary aria-disabled:cursor-wait"
      type="button"
      :aria-disabled="loading"
      :aria-label="`排序方式：${selectedLabel}`"
      :aria-controls="menuId"
      aria-haspopup="menu"
      :aria-expanded="open"
      @click="toggleMenu"
      @keydown.down.prevent="openMenu('first')"
      @keydown.up.prevent="openMenu('last')"
    >
      <span
        v-if="loading"
        class="loading loading-spinner size-[14px] text-primary"
        aria-hidden="true"
      ></span>
      <ArrowDownUp v-else :size="14" />
      {{ selectedLabel }}
    </button>
    <div
      v-if="open"
      :id="menuId"
      ref="optionsRef"
      class="absolute right-0 top-full z-20 mt-1 min-w-36 rounded-xl border border-base-300 bg-base-100 p-1"
      role="menu"
      aria-label="排序方式"
      @keydown="handleKeydown"
    >
      <button
        v-for="(option, index) in options"
        :key="option.value"
        class="flex min-h-11 w-full items-center justify-between gap-4 rounded-lg px-3 text-left text-sm hover:bg-base-200/70 focus-visible:bg-primary/5 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        :class="modelValue === option.value ? 'font-medium text-primary' : 'text-base-content/75'"
        type="button"
        role="menuitemradio"
        :tabindex="focusedIndex === index ? 0 : -1"
        :aria-checked="modelValue === option.value"
        @click="selectOption(option.value)"
        @focus="focusedIndex = index"
      >
        {{ option.label }}
        <Check v-if="modelValue === option.value" :size="15" />
      </button>
    </div>
  </div>
</template>
