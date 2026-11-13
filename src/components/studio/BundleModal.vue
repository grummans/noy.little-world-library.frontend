<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ApiError } from '../../api/client'
import {
  createBundle,
  listMyBooks,
  replaceBundleCover,
  updateBundle,
  type TeacherBook,
  type TeacherBundle,
} from '../../api/teacher'
import ConfirmDialog from '../app/ConfirmDialog.vue'
import ResultDialog from '../app/ResultDialog.vue'

const props = defineProps<{ open: boolean; bundle: TeacherBundle | null }>()
const emit = defineEmits<{ close: []; saved: [TeacherBundle] }>()

const router = useRouter()
// Every confirmed action ends in a dialog, success or failure.
const result = ref<{ tone: 'success' | 'error'; title: string; message?: string } | null>(null)

const title = ref('')
const description = ref('')
const priceVND = ref<number | null>(null)
const bookIds = ref<number[]>([])
const cover = ref<File | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)

const books = ref<TeacherBook[]>([])
const loadingBooks = ref(true)

const saving = ref(false)
const errorMessage = ref('')
const confirming = ref(false)
const confirmingCover = ref(false)
const confirmingDiscard = ref(false)
const pendingLeave = ref('')

const baseline = ref('')
const snapshot = () =>
  JSON.stringify([title.value, description.value, priceVND.value, [...bookIds.value].sort()])
const hasChanges = computed(() => baseline.value !== '' && snapshot() !== baseline.value)

// Only published books can go into a bundle; the API re-checks this on publish.
// Books already chosen stay listed so they can be removed after being unpublished.
const selectableBooks = computed(() => {
  const listed = books.value.filter(
    (book) => book.status === 'published' || bookIds.value.includes(book.id),
  )
  return listed.map((book) => ({ ...book, stale: book.status !== 'published' }))
})

const formError = computed(() => {
  if (!title.value.trim()) return 'Tên gói sách không được để trống.'
  if (!priceVND.value || priceVND.value <= 0) return 'Gói sách cần giá lớn hơn 0.'
  if (!bookIds.value.length) return 'Chọn ít nhất một cuốn sách đã xuất bản.'
  return ''
})

const message = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'

  switch (err.code) {
    case 'validation':
      return 'Thông tin chưa hợp lệ: kiểm tra tên, giá và sách trong gói.'
    case 'not_publishable':
      return 'Cần ít nhất một sách đã xuất bản trước khi xuất bản gói.'
    case 'slug_taken':
      return 'Đường dẫn (slug) đã được dùng cho gói khác.'
    case 'invalid_file':
      return 'Ảnh bìa phải là JPG hoặc PNG.'
    case 'not_found':
      return 'Không tìm thấy gói sách này, hoặc gói không thuộc tài khoản của bạn.'
    case 'storage_unavailable':
      return 'Máy chủ lưu trữ chưa sẵn sàng. Thử lại sau ít phút.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không lưu được gói sách. Vui lòng thử lại.'
  }
}

const reset = (bundle: TeacherBundle | null) => {
  title.value = bundle?.title ?? ''
  description.value = bundle?.description ?? ''
  priceVND.value = bundle?.price_vnd ?? null
  bookIds.value = [...(bundle?.book_ids ?? [])]
  cover.value = null
  errorMessage.value = ''
  confirming.value = false
  confirmingCover.value = false
  confirmingDiscard.value = false
  pendingLeave.value = ''
  baseline.value = snapshot()
}

watch(
  () => [props.open, props.bundle?.id] as const,
  async ([isOpen]) => {
    if (!isOpen) return

    reset(props.bundle)

    loadingBooks.value = true
    try {
      books.value = await listMyBooks()
    } catch {
      books.value = []
    } finally {
      loadingBooks.value = false
    }
  },
  { immediate: true },
)

const toggleBook = (id: number) => {
  bookIds.value = bookIds.value.includes(id)
    ? bookIds.value.filter((item) => item !== id)
    : [...bookIds.value, id]
}

const pickCover = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const looksImage = /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)
  if (!looksImage) {
    errorMessage.value = 'Bìa phải là ảnh JPG hoặc PNG.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'Bìa tối đa 5 MB.'
    return
  }
  errorMessage.value = ''
  cover.value = file
}

const requestSave = () => {
  if (saving.value || formError.value) return
  confirming.value = true
}

const save = async () => {
  confirming.value = false
  if (saving.value || formError.value) return

  saving.value = true
  errorMessage.value = ''
  try {
    const input = {
      title: title.value.trim(),
      description: description.value.trim(),
      priceVND: priceVND.value as number,
      bookIds: bookIds.value,
    }

    // An edit never sends a cover: a half-failed edit must not look like a failed save.
    const saved = props.bundle
      ? await updateBundle(props.bundle.id, input)
      : await createBundle({ ...input, cover: cover.value })

    baseline.value = snapshot()
    emit('saved', saved)
    result.value = props.bundle
      ? { tone: 'success', title: 'Đã cập nhật gói sách', message: 'Thay đổi đã hiển thị trong thư viện.' }
      : { tone: 'success', title: 'Đã tạo gói sách', message: 'Gói đang ở trạng thái nháp; xuất bản khi đã sẵn sàng.' }
  } catch (err) {
    result.value = { tone: 'error', title: 'Chưa lưu được gói sách', message: message(err) }
  } finally {
    saving.value = false
  }
}

const requestCover = () => {
  if (!cover.value) {
    coverInput.value?.click()
    return
  }
  confirmingCover.value = true
}

const uploadCover = async () => {
  confirmingCover.value = false
  const file = cover.value
  if (!props.bundle || !file) return

  saving.value = true
  errorMessage.value = ''
  try {
    const updated = await replaceBundleCover(props.bundle.id, file)
    cover.value = null
    emit('saved', updated)
    result.value = { tone: 'success', title: 'Đã cập nhật ảnh bìa gói sách', message: 'Ảnh bìa mới đã được lưu.' }
  } catch (err) {
    result.value = { tone: 'error', title: 'Chưa cập nhật được ảnh bìa', message: message(err) }
  } finally {
    saving.value = false
  }
}

const goToView = () => {
  if (!props.bundle) return
  const target = `/bundles/${props.bundle.slug}`
  if (hasChanges.value) {
    pendingLeave.value = target
    confirmingDiscard.value = true
    return
  }
  emit('close')
  void router.push(target)
}

const cancelLeave = () => {
  pendingLeave.value = ''
  confirmingDiscard.value = false
}

const leaveConfirmed = () => {
  const target = pendingLeave.value
  cancelLeave()
  emit('close')
  if (target) void router.push(target)
}

const close = () => {
  if (saving.value || confirming.value || confirmingDiscard.value) return
  if (hasChanges.value) {
    pendingLeave.value = ''
    confirmingDiscard.value = true
    return
  }
  emit('close')
}

const confirmText = computed(
  () =>
    `Lưu “${title.value.trim()}” với ${bookIds.value.length} sách, giá ${(priceVND.value ?? 0).toLocaleString('vi-VN')}đ?`,
)

defineExpose({ close })
</script>

<template>
  <div v-if="open" class="bundle" @click.self="close">
    <section
      class="bundle__card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="bundle-title"
      @keydown.esc="close"
    >
      <header class="bundle__head">
        <div>
          <h2 id="bundle-title">{{ bundle ? 'Sửa gói sách' : 'Tạo gói sách' }}</h2>
          <p class="bundle__meta">
            {{ bundle ? bundle.title : 'Gói gồm các sách đã xuất bản của bạn.' }}
          </p>
        </div>
        <button type="button" class="bundle__close" aria-label="Đóng" @click="close">✕</button>
      </header>

      <form class="bundle__body" @submit.prevent="requestSave">
        <label class="bundle__field">
          <span>Tên gói sách</span>
          <input v-model="title" type="text" maxlength="200" required />
        </label>

        <label class="bundle__field">
          <span>Mô tả ngắn</span>
          <textarea v-model="description" rows="3" maxlength="5000" />
        </label>

        <label class="bundle__field bundle__field--price">
          <span>Giá gói (VND)</span>
          <input
            v-model.number="priceVND"
            type="number"
            min="1"
            placeholder="Ví dụ 100000"
            aria-label="Giá gói (VND)"
            required
          />
        </label>

        <fieldset class="bundle__field">
          <legend>Chọn sách đưa vào gói</legend>
          <p v-if="loadingBooks" class="bundle__hint">Đang tải sách…</p>
          <p v-else-if="!selectableBooks.length" class="bundle__hint">
            Chưa có sách nào đã xuất bản. Xuất bản sách trước rồi quay lại tạo gói.
          </p>
          <div v-else class="bundle__books">
            <button
              v-for="book in selectableBooks"
              :key="book.id"
              type="button"
              class="bundle__book"
              :class="{
                'bundle__book--on': bookIds.includes(book.id),
                'bundle__book--stale': book.stale,
              }"
              :aria-pressed="bookIds.includes(book.id)"
              :title="book.stale ? 'Sách này đã ngừng xuất bản — bỏ khỏi gói để lưu được' : undefined"
              @click="toggleBook(book.id)"
            >
              {{ bookIds.includes(book.id) ? '✓' : '+' }} {{ book.title }}
              {{ book.stale ? ' (ngừng xuất bản)' : '' }}
            </button>
          </div>
          <p class="bundle__hint">{{ bookIds.length }} sách đã chọn</p>
        </fieldset>

        <div class="bundle__field">
          <span>Ảnh bìa (JPG/PNG, tối đa 5 MB)</span>
          <input
            ref="coverInput"
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            aria-label="Ảnh bìa gói sách"
            @change="pickCover"
          />
          <div class="bundle__cover">
            <button type="button" class="bundle__secondary" @click="requestCover">
              {{ cover ? 'Tải ảnh bìa lên' : bundle?.has_cover ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa' }}
            </button>
            <p v-if="cover" class="bundle__hint">✓ {{ cover.name }}</p>
            <p v-else-if="bundle" class="bundle__hint">
              {{ bundle.has_cover ? 'Gói đã có ảnh bìa.' : 'Gói chưa có ảnh bìa.' }}
            </p>
          </div>
        </div>

        <p v-if="formError" class="bundle__error" role="alert">{{ formError }}</p>
        <p v-else-if="errorMessage" class="bundle__error" role="alert">{{ errorMessage }}</p>

        <div class="bundle__actions">
          <button v-if="bundle" type="button" class="bundle__link" @click="goToView">
            Xem trang gói sách
          </button>
          <button type="button" class="bundle__secondary" @click="close">Hủy</button>
          <button
            type="submit"
            class="bundle__primary"
            :disabled="saving || Boolean(formError)"
          >
            {{ saving ? 'Đang lưu…' : bundle ? 'Lưu thay đổi' : 'Tạo gói' }}
          </button>
        </div>
      </form>
    </section>

    <ConfirmDialog
      :open="confirming"
      :title="bundle ? 'Lưu thay đổi gói sách?' : 'Tạo gói sách này?'"
      :message="confirmText"
      :confirm-label="bundle ? 'Lưu thay đổi' : 'Tạo gói'"
      @confirm="save"
      @cancel="confirming = false"
    />
    <ConfirmDialog
      :open="confirmingCover"
      title="Cập nhật ảnh bìa gói?"
      message="Ảnh mới thay ngay ảnh người mua đang thấy."
      confirm-label="Cập nhật ảnh bìa"
      @confirm="uploadCover"
      @cancel="confirmingCover = false"
    />
    <ConfirmDialog
      :open="confirmingDiscard"
      title="Hủy các thay đổi chưa lưu?"
      message="Những gì bạn vừa sửa sẽ mất, gói sách vẫn giữ thông tin cũ."
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
.bundle {
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

.bundle__card {
  background: #fff;
  border-radius: 24px;
  width: min(620px, 100%);
  max-height: 90vh;
  overflow-y: auto;
  padding: 24px 28px 22px;
}

.bundle__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
}

.bundle__head h2 {
  margin: 0;
  font-size: 24px;
}

.bundle__meta {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 14px;
}

.bundle__close {
  border: 0;
  background: transparent;
  color: #77847c;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 4px;
}

.bundle__body {
  display: flex;
  flex-direction: column;
  gap: 14px;
  margin-top: 18px;
}

.bundle__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}

.bundle__field--price input {
  max-width: 200px;
}

.bundle__field > span,
.bundle__field > legend {
  color: #77847c;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.bundle__field input[type="text"],
.bundle__field input[type="number"],
.bundle__field textarea {
  border: 1px solid #dee8db;
  border-radius: 12px;
  padding: 10px 12px;
  font: inherit;
  font-size: 14px;
  color: #34423b;
  background: #fff;
}

.bundle__books {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.bundle__book {
  border: 1px solid #dee8db;
  background: #fff8ec;
  border-radius: 999px;
  padding: 8px 14px 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #34423b;
  cursor: pointer;
}

.bundle__book--stale {
  border-style: dashed;
  color: #8a6d3b;
}

.bundle__book--on {
  background: #d9f1e1;
  border-color: #397653;
  color: #397653;
}

.bundle__hint {
  margin: 0;
  color: #77847c;
  font-size: 13px;
}

.bundle__cover {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.bundle__error {
  margin: 0;
  color: #b3261e;
  font-size: 14px;
  font-weight: 700;
}

.bundle__actions {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 4px;
}

.bundle__link {
  margin-right: auto;
  border: 0;
  background: none;
  padding: 0;
  color: #397653;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.bundle__primary,
.bundle__secondary {
  border-radius: 14px;
  padding: 11px 20px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  cursor: pointer;
}

.bundle__primary {
  border: 0;
  background: #397653;
  color: #fff;
}

.bundle__secondary {
  border: 1px solid #dee8db;
  background: #f5faf2;
  color: #397653;
}

.bundle__primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
