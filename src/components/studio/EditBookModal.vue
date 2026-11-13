<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ConfirmDialog from '../app/ConfirmDialog.vue'
import ResultDialog from '../app/ResultDialog.vue'
import { ApiError } from '../../api/client'
import {
  createTopic,
  listTopics,
  updateBook,
  type AccessType,
  type TeacherBook,
} from '../../api/teacher'
import type { Tag } from '../../api/catalog'

const props = defineProps<{ open: boolean; book: TeacherBook | null }>()
const emit = defineEmits<{ close: []; saved: [TeacherBook] }>()

const router = useRouter()

const title = ref('')
const description = ref('')
const accessType = ref<AccessType>('free')
const priceVND = ref<number | null>(null)
const ageMin = ref<number | null>(null)
const ageMax = ref<number | null>(null)
const topicId = ref<number | null>(null)
const topics = ref<Tag[]>([])
const newTopic = ref('')
const topicBusy = ref(false)
const saving = ref(false)
const cardRef = ref<HTMLElement | null>(null)

const fill = (book: TeacherBook) => {
  title.value = book.title
  description.value = book.description
  accessType.value = book.access_type
  priceVND.value = book.price_vnd
  ageMin.value = book.age_min
  ageMax.value = book.age_max
  topicId.value = book.tag_ids[0] ?? null
}

const confirming = ref(false)
const confirmingDiscard = ref(false)
const pendingTopic = ref('')
const pendingLeave = ref('')
// Every confirmed action ends in a dialog, success or failure.
const result = ref<{ tone: 'success' | 'error'; title: string; message?: string } | null>(null)

// Closing must not silently throw away edits the teacher has not confirmed.
const baseline = ref('')
const snapshot = () =>
  JSON.stringify([
    title.value,
    description.value,
    accessType.value,
    priceVND.value,
    ageMin.value,
    ageMax.value,
    topicId.value,
  ])
const hasChanges = computed(() => baseline.value !== '' && snapshot() !== baseline.value)

watch(
  () => [props.open, props.book?.id] as const,
  async ([isOpen]) => {
    if (!isOpen || !props.book) return

    fill(props.book)
    newTopic.value = ''
    confirming.value = false
    confirmingDiscard.value = false
    pendingTopic.value = ''
    baseline.value = snapshot()
    confirming.value = false
    // Focus the dialog so a keyboard user is not left behind the overlay.
    requestAnimationFrame(() => cardRef.value?.querySelector('input')?.focus())

    try {
      topics.value = await listTopics()
    } catch {
      // Optional: the form still works with whatever topics are already attached.
    }
  },
  { immediate: true },
)

// Mirrors the server rules so a bad value never needs a round trip.
const ageError = computed(() => {
  if (ageMin.value === null || ageMax.value === null) return ''
  if (ageMin.value < 0 || ageMax.value > 18) return 'Độ tuổi trong khoảng 0–18.'
  if (ageMin.value > ageMax.value) return 'Tuổi bắt đầu không được lớn hơn tuổi kết thúc.'
  return ''
})

const priceError = computed(() => {
  if (accessType.value !== 'paid') return ''
  if (!priceVND.value || priceVND.value <= 0) return 'Sách trả phí cần giá lớn hơn 0.'
  return ''
})

const goToFiles = () => {
  if (!props.book) return
  const target = `/studio/books/${props.book.id}`
  if (hasChanges.value) {
    pendingLeave.value = target
    confirmingDiscard.value = true
    return
  }
  emit('close')
  void router.push(target)
}

const leaveConfirmed = () => {
  const target = pendingLeave.value
  pendingLeave.value = ''
  confirmingDiscard.value = false
  emit('close')
  if (target) void router.push(target)
}

const cancelLeave = () => {
  pendingLeave.value = ''
  confirmingDiscard.value = false
}

const close = () => {
  // A request in flight owns the modal state; closing now would let its response land
  // on whatever book is opened next.
  if (saving.value || topicBusy.value || confirming.value) return
  if (confirmingDiscard.value) return
  if (hasChanges.value) {
    pendingLeave.value = ''
    confirmingDiscard.value = true
    return
  }
  emit('close')
}

// v-model.number turns a cleared field into "", which the API rejects as a number.
const toAge = (value: number | string | null): number | null => {
  if (value === null || value === '') return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

const formError = computed(() => {
  if (!title.value.trim()) return 'Tên sách không được để trống.'
  if (props.book?.status === 'published' && !description.value.trim()) {
    return 'Sách đã xuất bản cần mô tả ngắn.'
  }
  return ageError.value || priceError.value
})

const confirmText = computed(() => {
  const price =
    accessType.value === 'paid'
      ? `Trả phí · ${(priceVND.value ?? 0).toLocaleString('vi-VN')}đ`
      : 'Miễn phí'
  return `Lưu thay đổi cho “${title.value.trim()}”? ${price}. Giá và thông tin này sẽ hiển thị ngay trong thư viện.`
})

const message = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'

  switch (err.code) {
    case 'validation':
      return 'Thông tin chưa hợp lệ: kiểm tra tên sách, giá và độ tuổi.'
    case 'slug_taken':
      return 'Đường dẫn (slug) đã được dùng cho sách khác.'
    case 'tag_exists':
      return 'Chủ đề này đã tồn tại — chọn nó trong danh sách bên trên.'
    case 'not_found':
      return 'Không tìm thấy cuốn sách này, hoặc sách không thuộc tài khoản của bạn.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không lưu được thay đổi. Vui lòng thử lại.'
  }
}

// One topic per book: choosing another replaces it, choosing the same one clears it.
const toggleTopic = (id: number) => {
  topicId.value = topicId.value === id ? null : id
}

const askTopic = () => {
  if (!newTopic.value.trim() || topicBusy.value) return
  pendingTopic.value = newTopic.value.trim()
}

const addTopic = async () => {
  const name = pendingTopic.value
  pendingTopic.value = ''
  if (!name || topicBusy.value) return

  topicBusy.value = true
  try {
    const tag = await createTopic(name)
    topics.value = [...topics.value, tag].sort((a, b) => a.name.localeCompare(b.name))
    topicId.value = tag.id
    newTopic.value = ''
    result.value = { tone: 'success', title: 'Đã tạo chủ đề mới', message: `Chủ đề “${tag.name}” đã được chọn cho sách này.` }
  } catch (err) {
    result.value = { tone: 'error', title: 'Chưa tạo được chủ đề', message: message(err) }
  } finally {
    topicBusy.value = false
  }
}

// Esc must close the dialog even when focus sits outside it (e.g. right after a click
// on the backdrop), which is why the listener lives on the window.
const onKey = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !props.open) return
  // The confirm dialogs handle their own Esc; closing both at once loses the edits.
  if (confirming.value || confirmingDiscard.value || pendingTopic.value) return
  close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// Nothing is written until the teacher confirms: a price is easy to change by accident.


const requestSave = () => {
  if (!props.book || saving.value || formError.value || topicBusy.value) return
  confirming.value = true
}

const save = async () => {
  confirming.value = false
  const book = props.book
  if (!book || saving.value) return

  saving.value = true
  try {
    const updated = await updateBook(book.id, {
      title: title.value.trim(),
      description: description.value.trim(),
      access_type: accessType.value,
      price_vnd: accessType.value === 'paid' ? priceVND.value : null,
      age_min: toAge(ageMin.value),
      age_max: toAge(ageMax.value),
      tag_id: topicId.value,
    })
    // The book may have been switched while the request was in flight.
    if (props.book?.id === updated.id) {
      emit('saved', updated)
      result.value = { tone: 'success', title: 'Đã cập nhật thông tin sách', message: 'Thay đổi đã hiển thị trong thư viện.' }
    }
  } catch (err) {
    result.value = { tone: 'error', title: 'Chưa lưu được thay đổi', message: message(err) }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="open && book" class="editbook" @click.self="close">
    <section
      ref="cardRef"
      class="editbook__card"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editbook-title"
      @keydown.esc="close"
    >
      <header class="editbook__head">
        <div>
          <h2 id="editbook-title">Sửa sách</h2>
          <p class="editbook__meta">
            {{ book.title }} ·
            <span class="editbook__chip">
              {{ book.status === 'published' ? 'Đã xuất bản' : 'Bản nháp' }}
            </span>
          </p>
        </div>
        <button type="button" class="editbook__close" aria-label="Đóng" @click="close">
          ✕
        </button>
      </header>

      <form class="editbook__body" @submit.prevent="requestSave">
        <label class="editbook__field">
          <span>Tên sách</span>
          <input v-model="title" type="text" maxlength="200" required />
        </label>

        <label class="editbook__field">
          <span>Mô tả ngắn</span>
          <textarea v-model="description" rows="3" maxlength="5000" />
        </label>

        <fieldset class="editbook__field">
          <legend>Chủ đề</legend>
          <div class="editbook__chips">
            <button
              v-for="topic in topics"
              :key="topic.id"
              type="button"
              class="editbook__chip-button"
              :class="{ 'editbook__chip-button--on': topicId === topic.id }"
              :aria-pressed="topicId === topic.id"
              @click="toggleTopic(topic.id)"
            >
              {{ topic.name }}
            </button>
          </div>
          <div class="editbook__topic-add">
            <input
              v-model="newTopic"
              type="text"
              maxlength="50"
              placeholder="Chủ đề mới…"
              aria-label="Tên chủ đề mới"
            />
            <button type="button" :disabled="topicBusy" @click="askTopic">＋ Thêm</button>
          </div>
        </fieldset>

        <div class="editbook__row">
          <fieldset class="editbook__field">
            <legend>Lứa tuổi</legend>
            <div class="editbook__ages">
              <input
                v-model.number="ageMin"
                type="number"
                min="0"
                max="18"
                placeholder="Từ"
                aria-label="Tuổi bắt đầu"
              />
              <span>–</span>
              <input
                v-model.number="ageMax"
                type="number"
                min="0"
                max="18"
                placeholder="Đến"
                aria-label="Tuổi kết thúc"
              />
              <span class="editbook__unit">tuổi</span>
            </div>
          </fieldset>

          <fieldset class="editbook__field">
            <legend>Quyền truy cập</legend>
            <div class="editbook__segmented">
              <button
                type="button"
                :aria-pressed="accessType === 'free'"
                :class="{ 'editbook__seg--on': accessType === 'free' }"
                @click="accessType = 'free'"
              >
                Miễn phí
              </button>
              <button
                type="button"
                :aria-pressed="accessType === 'paid'"
                :class="{ 'editbook__seg--on': accessType === 'paid' }"
                @click="accessType = 'paid'"
              >
                Trả phí
              </button>
            </div>
            <input
              v-if="accessType === 'paid'"
              v-model.number="priceVND"
              type="number"
              min="1"
              placeholder="Giá (VND), ví dụ 25000"
              aria-label="Giá bán (VND)"
            />
          </fieldset>
        </div>

        <p v-if="formError" class="editbook__error" role="alert">{{ formError }}</p>

        <div class="editbook__actions">
          <button type="button" class="editbook__link" @click="goToFiles">Thay tệp EPUB / bìa</button>
          <button type="button" class="editbook__secondary" @click="close">Hủy</button>
          <button
            type="submit"
            class="editbook__primary"
            :disabled="saving || Boolean(formError) || topicBusy"
          >
            {{ saving ? 'Đang lưu…' : 'Lưu thay đổi' }}
          </button>
        </div>
      </form>
    </section>

    <ConfirmDialog
      :open="Boolean(pendingTopic)"
      title="Tạo chủ đề mới?"
      :message="pendingTopic ? 'Chủ đề “' + pendingTopic + '” sẽ được thêm vào danh sách chủ đề dùng chung.' : ''"
      confirm-label="Tạo chủ đề"
      @confirm="addTopic"
      @cancel="pendingTopic = ''"
    />
    <ConfirmDialog
      :open="confirming"
      title="Lưu thay đổi này?"
      :message="confirmText"
      confirm-label="Lưu thay đổi"
      @confirm="save"
      @cancel="confirming = false"
    />
    <ConfirmDialog
      :open="confirmingDiscard"
      title="Hủy các thay đổi chưa lưu?"
      message="Những gì bạn vừa sửa sẽ mất, sách vẫn giữ thông tin cũ."
      confirm-label="Hủy thay đổi"
      @confirm="leaveConfirmed"
      @cancel="cancelLeave"
    />
  </div>

  <ResultDialog
    :open="Boolean(result)"
    :tone="result?.tone ?? 'success'"
    :title="result?.title ?? ''"
    :message="result?.message"
    @close="result = null"
  />
</template>

<style scoped>
.editbook {
  position: fixed;
  inset: 0;
  z-index: 60;
  background: rgba(34, 58, 43, 0.42);
  display: grid;
  place-items: center;
  padding: 24px;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.editbook__card {
  background: #fff;
  border-radius: 24px;
  width: min(620px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px 28px 22px;
}

.editbook__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.editbook__head h2 {
  margin: 0;
  font-size: 24px;
}

.editbook__meta {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 14px;
}

.editbook__chip {
  background: #d9f1e1;
  color: #397653;
  font-weight: 700;
  font-size: 12px;
  padding: 3px 10px 1px;
  border-radius: 999px;
}

.editbook__close {
  border: 0;
  background: transparent;
  color: #77847c;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
}

.editbook__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.editbook__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.editbook__field > span,
.editbook__field > legend {
  color: #77847c;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.editbook__field input[type="text"],
.editbook__field input[type="number"],
.editbook__field textarea {
  border: 1px solid #dee8db;
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  color: #34423b;
  background: #fff;
}

.editbook__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.editbook__chip-button {
  border: 1px solid #dee8db;
  background: #fff;
  border-radius: 999px;
  padding: 7px 14px 5px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #34423b;
  cursor: pointer;
}

.editbook__chip-button--on {
  background: #d9f1e1;
  border-color: #397653;
  color: #397653;
}

.editbook__topic-add {
  display: flex;
  gap: 8px;
  margin-top: 6px;
}

.editbook__topic-add input {
  flex: 1;
  border: 1px solid #dee8db;
  border-radius: 10px;
  padding: 8px 10px;
  font: inherit;
  font-size: 13px;
}

.editbook__topic-add button {
  border: 1px solid #dee8db;
  background: #f5faf2;
  border-radius: 10px;
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #397653;
  cursor: pointer;
}

.editbook__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

.editbook__ages {
  display: flex;
  align-items: center;
  gap: 8px;
}

.editbook__ages input {
  width: 76px;
}

.editbook__unit {
  color: #77847c;
  font-size: 14px;
}

.editbook__segmented {
  display: flex;
  gap: 8px;
  margin-bottom: 6px;
}

.editbook__segmented button {
  border: 1px solid #dee8db;
  background: #fff;
  border-radius: 999px;
  padding: 8px 16px 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #34423b;
  cursor: pointer;
}

.editbook__segmented button.editbook__seg--on {
  background: #397653;
  border-color: #397653;
  color: #fff;
}

.editbook__error {
  margin: 0;
  color: #b3261e;
  font-size: 14px;
  font-weight: 700;
}

.editbook__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.editbook__link {
  margin-right: auto;
  border: 0;
  background: none;
  padding: 0;
  cursor: pointer;
  text-decoration: underline;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
}

.editbook__primary,
.editbook__secondary {
  border-radius: 14px;
  padding: 11px 20px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.editbook__primary {
  border: 0;
  background: #397653;
  color: #fff;
}

.editbook__secondary {
  border: 1px solid #dee8db;
  background: #f5faf2;
  color: #397653;
}

.editbook__primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
