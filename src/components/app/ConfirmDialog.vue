<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

// A single shared confirm: every state-changing action goes through it, so no click
// ever writes to the server without an explicit yes.
const props = defineProps<{
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  // While the action it started is still running, the answer cannot be taken back: the
  // buttons and Escape wait for it.
  busy?: boolean
}>()
const emit = defineEmits<{ confirm: []; cancel: [] }>()

const card = ref<HTMLElement | null>(null)
// Focus goes back where it came from, or the keyboard never left the dialog's opener.
let opener: HTMLElement | null = null

const cancel = () => {
  if (!props.busy) emit('cancel')
}
watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      opener?.focus()
      opener = null
      return
    }
    opener = document.activeElement as HTMLElement | null
    await nextTick()
    card.value?.querySelector<HTMLElement>('button')?.focus()
  },
)

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) cancel()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)

// The listener must not outlive the dialog when the parent unmounts it while open.
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="open" class="confirm" @click.self="cancel">
    <section
      ref="card"
      class="confirm__card"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      :aria-busy="busy ? 'true' : undefined"
    >
      <h2 id="confirm-title">{{ title }}</h2>
      <p v-if="message" class="confirm__message">{{ message }}</p>
      <div class="confirm__actions">
        <button
          type="button"
          class="confirm__secondary"
          :disabled="busy"
          @click="cancel"
        >
          Quay lại
        </button>
        <button
          type="button"
          class="confirm__primary"
          :disabled="busy"
          @click="emit('confirm')"
        >
          {{ busy ? 'Đang xử lý…' : (confirmLabel ?? 'Đồng ý') }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.confirm {
  position: fixed;
  inset: 0;
  z-index: 70;
  background: rgba(34, 58, 43, 0.42);
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.confirm__card {
  background: #fff;
  border-radius: 22px;
  padding: 24px 26px 20px;
  width: min(460px, 100%);
}

.confirm__card h2 {
  margin: 0;
  font-size: 21px;
}

.confirm__message {
  margin: 10px 0 0;
  color: #77847c;
  font-size: 15px;
  line-height: 1.5;
}

.confirm__actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 20px;
}

.confirm__primary,
.confirm__secondary {
  border-radius: 14px;
  padding: 11px 20px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.confirm__primary:disabled,
.confirm__secondary:disabled {
  opacity: 0.65;
  cursor: default;
}
.confirm__primary {
  border: 0;
  background: #397653;
  color: #fff;
}

.confirm__secondary {
  border: 1px solid #dee8db;
  background: #f5faf2;
  color: #397653;
}
</style>
