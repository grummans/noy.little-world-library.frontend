<script setup lang="ts" generic="Value extends string | number | null">
// A listbox the project can style. A native <select>'s open list is drawn by the OS: blue
// highlight, square corners, none of our palette — so the pill looked right until clicked.
// This keeps the same trigger look and draws the options ourselves.
//
// Sizing is inherited through CSS variables so each screen keeps its own metrics:
// --select-radius, --select-height, --select-padding, --select-border, --select-font-size.
import { computed, nextTick, onBeforeUnmount, ref, useId, watch } from 'vue'

type Option = { value: Value; label: string }

const props = defineProps<{
  options: Option[]
  // Not `aria-label`: a component prop with that name is read as the plain HTML attribute.
  label: string
  placeholder?: string
}>()

const model = defineModel<Value>({ required: true })

// useId, not a counter: <script setup> runs per instance, so a module counter would repeat.
const listId = `select-${useId()}`
const labelId = `${listId}-label`
const root = ref<HTMLElement | null>(null)
const open = ref(false)
const active = ref(0)
const trigger = ref<HTMLButtonElement | null>(null)
const list = ref<HTMLElement | null>(null)

const current = computed(() => props.options.find((option) => option.value === model.value))
const shownLabel = computed(() => current.value?.label ?? props.placeholder ?? '')

const show = async () => {
  open.value = true
  const index = props.options.findIndex((option) => option.value === model.value)
  active.value = Math.max(0, index)
  await nextTick()
  list.value?.querySelector('.select__option--active')?.scrollIntoView({ block: 'nearest' })
}

const hide = () => {
  open.value = false
}

const pick = (index: number) => {
  const option = props.options[index]
  if (!option) return
  model.value = option.value
  hide()
  trigger.value?.focus()
}

const scrollActive = () =>
  nextTick(() =>
    list.value?.querySelector('.select__option--active')?.scrollIntoView({ block: 'nearest' }),
  )

const move = (step: number) => {
  const count = props.options.length
  if (!count) return
  active.value = (active.value + step + count) % count
  scrollActive()
}

const onKeydown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (open.value) move(1)
      else show()
      break
    case 'ArrowUp':
      event.preventDefault()
      if (open.value) move(-1)
      else show()
      break
    case 'Home':
      if (!open.value) return
      event.preventDefault()
      active.value = 0
      scrollActive()
      break
    case 'End':
      if (!open.value) return
      event.preventDefault()
      active.value = props.options.length - 1
      scrollActive()
      break
    case 'Enter':
    case ' ':
      event.preventDefault()
      if (open.value) pick(active.value)
      else show()
      break
    case 'Escape':
      if (!open.value) return
      event.preventDefault()
      hide()
      break
    case 'Tab':
      hide()
      break
  }
}

// A click anywhere else closes the list; the listener only exists while it is open.
const onDocumentPointer = (event: PointerEvent) => {
  // contains(trigger), not !== trigger: the click target is often the inner span or icon, and
  // treating that as an outside click closed then instantly reopened the menu.
  if (!root.value?.contains(event.target as Node)) hide()
}
watch(open, (isOpen) => {
  if (isOpen) document.addEventListener('pointerdown', onDocumentPointer)
  else document.removeEventListener('pointerdown', onDocumentPointer)
})
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointer))
</script>

<template>
  <div ref="root" class="select">
    <span :id="labelId" class="sr-only">{{ label }}</span>
    <button
      ref="trigger"
      type="button"
      class="select__trigger"
      role="combobox"
      :aria-labelledby="labelId"
      aria-haspopup="listbox"
      :aria-expanded="open"
      :aria-controls="open ? listId : undefined"
      :aria-activedescendant="open ? `${listId}-${active}` : undefined"
      @click="open ? hide() : show()"
      @keydown="onKeydown"
    >
      <span class="select__value">{{ shownLabel }}</span>
      <svg class="select__chevron" :class="{ 'select__chevron--open': open }" viewBox="0 0 12 8" aria-hidden="true">
        <path d="M1 1.5 6 6.5 11 1.5" fill="none" stroke="currentColor" stroke-width="1.6" />
      </svg>
    </button>

    <ul v-if="open" :id="listId" ref="list" class="select__list" role="listbox" :aria-label="label">
      <li
        v-for="(option, index) in options"
        :id="`${listId}-${index}`"
        :key="`${option.value}`"
        class="select__option"
        :class="{
          'select__option--active': index === active,
          'select__option--chosen': option.value === model,
        }"
        role="option"
        :aria-selected="option.value === model"
        @mouseenter="active = index"
        @mousedown.prevent="pick(index)"
      >
        {{ option.label }}
      </li>
    </ul>
  </div>
</template>

<style scoped>
.select {
  position: relative;
}

/* A long selected value shrinks with an ellipsis instead of pushing the chevron out. */
.select__value {
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.select__trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  width: 100%;
  height: var(--select-height, auto);
  padding: var(--select-padding, 11px 16px);
  border: 1px solid var(--select-border, #e3ded2);
  border-radius: var(--select-radius, 999px);
  background: #fff;
  color: #34423b;
  font: inherit;
  font-size: var(--select-font-size, inherit);
  font-weight: var(--select-font-weight, inherit);
  text-align: left;
  cursor: pointer;
}

.select__trigger:hover {
  border-color: #c9d6cc;
}

.select__trigger:focus-visible {
  outline: 2px solid #397653;
  outline-offset: 2px;
}

.select__chevron {
  flex: 0 0 auto;
  width: 12px;
  height: 8px;
  color: #77847c;
  transition: transform 0.15s ease;
}

.select__chevron--open {
  transform: rotate(180deg);
}

.select__list {
  position: absolute;
  z-index: 20;
  top: calc(100% + 6px);
  left: 0;
  min-width: 100%;
  /* A 60-character game type must not push the list off a phone screen. */
  max-width: min(320px, calc(100vw - 32px));
  max-height: 260px;
  margin: 0;
  padding: 6px;
  overflow-y: auto;
  list-style: none;
  border: 1px solid #efe7d8;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 12px 28px rgba(52, 66, 59, 0.14);
}

.select__option {
  padding: 9px 12px;
  border-radius: 10px;
  color: #34423b;
  font-size: 14px;
  overflow-wrap: anywhere;
  cursor: pointer;
}

.select__option--active {
  background: #f0f6f1;
}

.select__option--chosen {
  color: #397653;
  font-weight: 700;
}
</style>
