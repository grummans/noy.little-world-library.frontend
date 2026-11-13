<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

// The result of a confirmed action is always a dialog, never a toast: a toast slides away at
// the bottom of the screen, while the answer to "are you sure?" has to be acknowledged —
// whether it worked or failed.
const props = defineProps<{
  open: boolean
  title: string
  message?: string
  tone?: 'success' | 'error'
  primaryLabel?: string
}>()
const emit = defineEmits<{ close: [] }>()

const card = ref<HTMLElement | null>(null)
// Focus returns to whatever opened the dialog, so the keyboard is never stranded.
let opener: HTMLElement | null = null

const close = () => emit('close')

watch(
  () => props.open,
  async (isOpen) => {
    if (!isOpen) {
      // The opener can be gone: the confirm dialog that led here has unmounted.
      if (opener?.isConnected) opener.focus()
      opener = null
      return
    }
    opener = document.activeElement as HTMLElement | null
    await nextTick()
    card.value?.querySelector<HTMLElement>('button')?.focus()
  },
)

const onKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && props.open) close()
}

watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) window.addEventListener('keydown', onKey)
    else window.removeEventListener('keydown', onKey)
  },
  { immediate: true },
)

onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div v-if="open" class="result" :class="`result--${tone ?? 'success'}`" @click.self="close">
    <section
      ref="card"
      class="result__card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="result-title"
    >
      <span class="result__mark" aria-hidden="true">{{ (tone ?? 'success') === 'success' ? '✓' : '!' }}</span>
      <h2 id="result-title">{{ title }}</h2>
      <p v-if="message" class="result__message">{{ message }}</p>
      <div class="result__actions">
        <button type="button" class="result__primary" @click="close">
          {{ primaryLabel ?? 'Xong' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.result {
  position: fixed;
  inset: 0;
  z-index: 75;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(34, 58, 43, 0.42);
  color: #34423b;
  font-family: "Nunito", system-ui, sans-serif;
}

.result__card {
  width: min(460px, 100%);
  padding: 26px 26px 20px;
  border-radius: 22px;
  background: #fff;
  text-align: center;
}

.result__mark {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  margin: 0 auto 12px;
  border-radius: 50%;
  background: #d9f1e1;
  color: #397653;
  font-size: 22px;
  font-weight: 800;
}

.result--error .result__mark {
  background: #fdeceb;
  color: #b3261e;
}

.result__card h2 {
  margin: 0;
  font-size: 21px;
}

.result__message {
  margin: 10px 0 0;
  color: #77847c;
  font-size: 15px;
  line-height: 1.5;
}

.result__actions {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.result--error .result__primary {
  background: #b3261e;
}

.result__primary {
  padding: 11px 26px;
  border: 0;
  border-radius: 14px;
  background: #397653;
  color: #fff;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}
</style>
