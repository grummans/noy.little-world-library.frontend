<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import { ApiError } from '../../api/client'
import ConfirmDialog from '../app/ConfirmDialog.vue'
import AppToast from '../app/AppToast.vue'
import { useToast } from '../../composables/useToast'
import {
  createBook,
  createTopic,
  listTopics,
  publishBook,
  type TeacherBook,
} from '../../api/teacher'
import type { Tag } from '../../api/catalog'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: []; saved: [] }>()

const router = useRouter()

type Step = 'file' | 'details' | 'confirm' | 'done' | 'failed'

const step = ref<Step>('file')
const epub = ref<File | null>(null)
const cover = ref<File | null>(null)
const dragging = ref(false)
const epubInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const submitting = ref(false)
const errorMessage = ref('')

const title = ref('')
const description = ref('')
const accessType = ref<'free' | 'paid'>('free')
const priceVND = ref<number | null>(null)
const ageMin = ref<number | null>(null)
const ageMax = ref<number | null>(null)
const topicId = ref<number | null>(null)
const topics = ref<Tag[]>([])
const newTopic = ref('')
const topicBusy = ref(false)

const createdBook = ref<TeacherBook | null>(null)
const published = ref(false)
const publishFailed = ref(false)
const confirmingDiscard = ref(false)
const pendingTopic = ref('')
const { message: toast, show: showToast } = useToast()

const MAX_EPUB_BYTES = 50 * 1024 * 1024

onMounted(async () => {
  try {
    topics.value = await listTopics()
  } catch {
    // Topics are optional: the form still works without them.
    topics.value = []
  }
})

const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`

const pickEpub = (file: File | null | undefined) => {
  if (!file) return
  errorMessage.value = ''

  if (!file.name.toLowerCase().endsWith('.epub')) {
    errorMessage.value = 'Chỉ nhận tệp .epub. Bé kiểm tra lại tệp nhé.'
    return
  }
  if (file.size > MAX_EPUB_BYTES) {
    errorMessage.value = `Tệp ${fileSize(file.size)} vượt giới hạn 50 MB.`
    return
  }
  epub.value = file
  if (!title.value) title.value = file.name.replace(/\.epub$/i, '')
}

const onDrop = (event: DragEvent) => {
  dragging.value = false
  pickEpub(event.dataTransfer?.files?.[0])
}

const onEpubInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  pickEpub(input.files?.[0])
  input.value = ''
}

const onCoverInput = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  // Some systems report an empty type for a perfectly good PNG; the extension and the
  // server-side image decode are the real checks.
  const looksImage =
    /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)
  if (!looksImage) {
    errorMessage.value = 'Bìa phải là ảnh JPG hoặc PNG.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    errorMessage.value = 'Bìa tối đa 5 MB.'
    return
  }
  cover.value = file
  errorMessage.value = ''
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
  errorMessage.value = ''
  try {
    const tag = await createTopic(name)
    topics.value = [...topics.value, tag].sort((a, b) => a.name.localeCompare(b.name))
    topicId.value = tag.id
    newTopic.value = ''
    showToast('Đã tạo chủ đề mới.')
  } catch (err) {
    errorMessage.value = uploadMessage(err)
  } finally {
    topicBusy.value = false
  }
}

// One topic per book: choosing another replaces it, choosing the same one clears it.
const toggleTopic = (id: number) => {
  topicId.value = topicId.value === id ? null : id
}

const canContinue = computed(() => Boolean(epub.value) && title.value.trim().length > 0)
const canPublish = computed(
  () => Boolean(cover.value) && description.value.trim().length > 0 && !busy(),
)
const busy = () => submitting.value || topicBusy.value

// The server enforces the same rule; catching it here avoids uploading 11 MB to find out.
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

const detailsError = computed(() => ageError.value || priceError.value)


const uploadMessage = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'

  switch (err.code) {
    case 'invalid_file':
      return 'Tệp không hợp lệ: EPUB phải đúng chuẩn và bìa phải là ảnh JPG/PNG.'
    case 'validation':
      return 'Thông tin chưa hợp lệ: kiểm tra tên sách, giá và độ tuổi.'
    case 'slug_taken':
      return 'Đường dẫn (slug) đã được dùng. Đổi tên sách hoặc slug khác.'
    case 'tag_exists':
      return 'Chủ đề này đã tồn tại — chọn nó trong danh sách bên trên.'
    case 'storage_unavailable':
      return 'Máy chủ lưu trữ chưa sẵn sàng. Thử lại sau ít phút.'
    case 'not_publishable':
      return 'Cần bìa, EPUB và mô tả trước khi xuất bản.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không tải lên được. Vui lòng thử lại.'
  }
}

// Esc must close the dialog even when focus sits outside it (e.g. right after a click
// on the backdrop), which is why the listener lives on the window.
const close = () => {
  if (submitting.value || topicBusy.value || confirmingDiscard.value) return
  const unsaved =
    (step.value === 'file' && epub.value !== null) ||
    step.value === 'details' ||
    step.value === 'confirm' ||
    (step.value === 'failed' && !publishFailed.value)
  if (unsaved) {
    confirmingDiscard.value = true
    return
  }
  emit('close')
}

const onKey = (event: KeyboardEvent) => {
  if (event.key !== 'Escape' || !props.open) return
  // The confirm dialogs handle their own Esc; closing both at once loses the form.
  if (confirmingDiscard.value || pendingTopic.value) return
  close()
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const save = async (publishNow: boolean) => {
  if (!epub.value || busy() || detailsError.value) return

  submitting.value = true
  errorMessage.value = ''
  try {
    const book = await createBook({
      title: title.value.trim(),
      description: description.value.trim(),
      accessType: accessType.value,
      priceVND: accessType.value === 'paid' ? priceVND.value : null,
      ageMin: ageMin.value,
      ageMax: ageMax.value,
      tagId: topicId.value,
      epub: epub.value,
      cover: cover.value,
    })
    createdBook.value = book
    emit('saved')

    if (!publishNow) {
      published.value = false
      step.value = 'done'
      showToast('Đã lưu bản nháp.')
      return
    }

    try {
      createdBook.value = await publishBook(book.id)
      published.value = true
      showToast('Đã xuất bản sách.')
      emit('saved')
      step.value = 'done'
    } catch (err) {
      // The book exists as a draft now: say so instead of pretending nothing was saved.
      publishFailed.value = true
      errorMessage.value = `${uploadMessage(err)} Sách đã được lưu ở dạng bản nháp.`
      step.value = 'failed'
    }
  } catch (err) {
    publishFailed.value = false
    errorMessage.value = uploadMessage(err)
    step.value = 'failed'
  } finally {
    submitting.value = false
  }
}

const restart = () => {
  step.value = 'file'
  epub.value = null
  cover.value = null
  createdBook.value = null
  published.value = false
  errorMessage.value = ''
  title.value = ''
  description.value = ''
  accessType.value = 'free'
  priceVND.value = null
  ageMin.value = null
  ageMax.value = null
  topicId.value = null
  newTopic.value = ''
  confirmingDiscard.value = false
  pendingTopic.value = ''
}

// Opening the dialog always starts from a clean form, and closing it must not leave a
// half-filled draft state for the next open.
watch(
  () => props.open,
  (isOpen) => {
    if (isOpen) restart()
  },
)

const openEdit = () => {
  if (createdBook.value) void router.push(`/studio/books/${createdBook.value.id}`)
}
</script>

<template>
  <div v-if="open" class="upload" @click.self="close">
    <section
      class="upload__card"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
      @keydown.esc="close"
    >
      <button type="button" class="upload__close" aria-label="Đóng" @click="close">
        ✕
      </button>
        <header class="upload__head">
          <h1 id="upload-title">
            {{
              step === 'file'
                ? 'Tải sách EPUB'
                : step === 'details'
                  ? 'Hoàn thiện thông tin'
                  : step === 'confirm'
                    ? 'Xuất bản sách này?'
                    : step === 'done'
                      ? published
                        ? 'Đã xuất bản!'
                        : 'Đã lưu bản nháp'
                      : 'Chưa tải lên được'
            }}
          </h1>
          <p class="upload__subtitle">
            {{
              step === 'file'
                ? 'Tệp được lưu thành bản nháp. Bạn sẽ chỉnh sửa thông tin trước khi xuất bản.'
                : step === 'details'
                  ? 'EPUB đã sẵn sàng. Điền thông tin bé sẽ thấy trong thư viện.'
                  : step === 'confirm'
                    ? 'Sách sẽ hiển thị trong Thư viện với thông tin và giá bạn đã thiết lập.'
                    : step === 'done'
                      ? published
                        ? 'Cuốn sách đã có trong thư viện công khai.'
                        : 'Sách đang ở trạng thái nháp, chỉ bạn nhìn thấy.'
                      : 'Kiểm tra lại tệp và thông tin rồi thử lại.'
            }}
          </p>
        </header>

        <!-- Step 1: drop zone -->
        <div v-if="step === 'file'" class="upload__body">
          <div
            class="upload__drop"
            :class="{ 'upload__drop--active': dragging }"
            role="button"
            tabindex="0"
            aria-label="Kéo EPUB vào đây hoặc chọn tệp"
            @click="epubInput?.click()"
            @keydown.enter.prevent="epubInput?.click()"
            @keydown.space.prevent="epubInput?.click()"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            <span class="upload__cloud" aria-hidden="true">☁</span>
            <p class="upload__drop-title">Kéo EPUB vào đây hoặc chọn tệp</p>
            <p class="upload__drop-hint">Chỉ nhận .epub · tối đa 50 MB</p>
          </div>
          <input
            ref="epubInput"
            class="sr-only"
            type="file"
            accept=".epub,application/epub+zip"
            @change="onEpubInput"
          />

          <p v-if="epub" class="upload__file">
            ✓ {{ epub.name }} · {{ fileSize(epub.size) }}
          </p>

          <button
            type="button"
            class="upload__primary"
            :disabled="!epub"
            @click="step = 'details'"
          >
            Tiếp tục  →
          </button>
          <p class="upload__flow">EPUB tải lên → Bản nháp → Chỉnh sửa thông tin → Xuất bản</p>
        </div>

        <!-- Step 2: metadata -->
        <form v-else-if="step === 'details'" class="upload__body" @submit.prevent="step = 'confirm'">
          <div class="upload__grid">
            <label class="upload__field upload__field--wide">
              <span>Tên sách</span>
              <input v-model="title" type="text" maxlength="200" required />
            </label>

            <fieldset class="upload__field">
              <legend>Chủ đề</legend>
              <div class="upload__chips">
                <button
                  v-for="topic in topics"
                  :key="topic.id"
                  type="button"
                  class="upload__chip"
                  :class="{ 'upload__chip--on': topicId === topic.id }"
                  :aria-pressed="topicId === topic.id"
                  @click="toggleTopic(topic.id)"
                >
                  {{ topic.name }}
                </button>
              </div>
              <div class="upload__topic-add">
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

            <fieldset class="upload__field">
              <legend>Lứa tuổi</legend>
              <div class="upload__ages">
                <input v-model.number="ageMin" type="number" min="0" max="18" placeholder="Từ" aria-label="Tuổi bắt đầu" />
                <span>–</span>
                <input v-model.number="ageMax" type="number" min="0" max="18" placeholder="Đến" aria-label="Tuổi kết thúc" />
                <span class="upload__unit">tuổi</span>
              </div>
            </fieldset>

            <fieldset class="upload__field upload__field--wide">
              <legend>Quyền truy cập</legend>
              <div class="upload__segmented">
                <button
                  type="button"
                  :aria-pressed="accessType === 'free'"
                  :class="{ 'upload__seg--on': accessType === 'free' }"
                  @click="accessType = 'free'"
                >
                  Miễn phí
                </button>
                <button
                  type="button"
                  :aria-pressed="accessType === 'paid'"
                  :class="{ 'upload__seg--on': accessType === 'paid' }"
                  @click="accessType = 'paid'"
                >
                  Trả phí
                </button>
              </div>
              <input
                v-if="accessType === 'paid'"
                v-model.number="priceVND"
                class="upload__price"
                type="number"
                min="1"
                placeholder="Giá (VND), ví dụ 25000"
                aria-label="Giá bán (VND)"
                required
              />
            </fieldset>

            <label class="upload__field upload__field--wide">
              <span>Mô tả ngắn</span>
              <textarea v-model="description" rows="3" maxlength="5000" />
            </label>

            <div class="upload__field upload__field--wide">
              <span>Ảnh bìa (JPG/PNG, tối đa 5 MB)</span>
              <input
                ref="coverInput"
                class="sr-only"
                type="file"
                accept="image/jpeg,image/png"
                aria-label="Tệp ảnh bìa"
                @change="onCoverInput"
              />
              <button
                type="button"
                class="upload__secondary"
                aria-label="Chọn ảnh bìa cho sách"
                @click="coverInput?.click()"
              >
                {{ cover ? 'Đổi ảnh bìa' : 'Chọn ảnh bìa' }}
              </button>
              <p v-if="cover" class="upload__file">✓ {{ cover.name }} · {{ fileSize(cover.size) }}</p>
            </div>
          </div>

          <p v-if="detailsError" class="upload__error" role="alert">{{ detailsError }}</p>
          <p v-else-if="errorMessage" class="upload__error" role="alert">{{ errorMessage }}</p>

          <div class="upload__actions">
            <button type="button" class="upload__secondary" @click="step = 'file'">
              ← Đổi tệp
            </button>
            <button
              type="submit"
              class="upload__primary"
              :disabled="!canContinue || Boolean(detailsError) || topicBusy"
            >
              Xem trước &amp; xác nhận →
            </button>
          </div>
        </form>

        <!-- Step 3: confirm -->
        <div v-else-if="step === 'confirm'" class="upload__body">
          <p class="upload__confirm-title">{{ title }}</p>
          <ul class="upload__checks">
            <li>✓ EPUB đã tải lên</li>
            <li :class="{ 'upload__check--missing': !description.trim() }">
              {{ description.trim() ? '✓' : '!' }} Thông tin sách
              {{ description.trim() ? 'đã hoàn tất' : 'còn thiếu mô tả' }}
            </li>
            <li :class="{ 'upload__check--missing': !cover }">
              {{ cover ? '✓' : '!' }} Ảnh bìa
              {{ cover ? 'đã chọn' : 'chưa có (bắt buộc để xuất bản)' }}
            </li>
            <li>
              {{ accessType === 'paid' ? `Trả phí · ${(priceVND ?? 0).toLocaleString('vi-VN')}đ` : 'Miễn phí' }}
            </li>
          </ul>

          <p v-if="errorMessage" class="upload__error" role="alert">{{ errorMessage }}</p>

          <div class="upload__actions">
            <button type="button" class="upload__secondary" @click="step = 'details'">
              Quay lại chỉnh sửa
            </button>
            <button
              type="button"
              class="upload__secondary"
              :disabled="submitting"
              @click="save(false)"
            >
              Lưu bản nháp
            </button>
            <button
              type="button"
              class="upload__primary"
              :disabled="submitting || !canPublish"
              @click="save(true)"
            >
              {{ submitting ? 'Đang lưu…' : 'Xuất bản ngay' }}
            </button>
          </div>
        </div>

        <!-- Step 4: done -->
        <div v-else-if="step === 'done'" class="upload__body">
          <p class="upload__done">
            {{ published ? '🎉' : '📝' }}
            <strong>{{ createdBook?.title }}</strong>
            {{ published ? 'đã được xuất bản.' : 'đã được lưu ở dạng bản nháp.' }}
          </p>
          <div class="upload__actions">
            <button type="button" class="upload__secondary" @click="close">Đóng</button>
            <button type="button" class="upload__secondary" @click="openEdit">Sửa thông tin</button>
            <RouterLink v-if="published" class="upload__primary" :to="`/books/${createdBook?.slug}`">
              Xem trong thư viện
            </RouterLink>
            <button v-else type="button" class="upload__primary" @click="restart">
              Tải sách khác
            </button>
          </div>
        </div>

        <!-- Step 5: failed -->
        <div v-else class="upload__body">
          <p class="upload__error" role="alert">{{ errorMessage }}</p>
          <div class="upload__actions">
            <button v-if="!publishFailed" type="button" class="upload__secondary" @click="step = 'details'">
              Quay lại chỉnh sửa
            </button>
            <button v-if="publishFailed" type="button" class="upload__secondary" @click="close">
              Đóng
            </button>
            <button v-else type="button" class="upload__primary" @click="restart">Tải lại từ đầu</button>
          </div>
        </div>
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
      :open="confirmingDiscard"
      title="Bỏ lần tải sách này?"
      message="Thông tin và tệp bạn vừa chọn sẽ mất, chưa có gì được lưu."
      confirm-label="Bỏ"
      @confirm="emit('close')"
      @cancel="confirmingDiscard = false"
    />
  </div>

  <AppToast :message="toast" />
</template>

<style scoped>
.upload {
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

.upload__card {
  position: relative;
  background: #fff;
  border-radius: 24px;
  padding: 28px 32px 24px;
  width: min(660px, 100%);
  max-height: 90vh;
  overflow-y: auto;
}

.upload__close {
  position: absolute;
  top: 14px;
  right: 16px;
  border: 0;
  background: transparent;
  color: #77847c;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
  padding: 6px;
}

.upload__head h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
}

.upload__subtitle {
  margin: 8px 0 0;
  color: #77847c;
  font-size: 15px;
}

.upload__body {
  margin-top: 22px;
}

.upload__drop {
  border: 1px dashed #397653;
  background: #f5faf2;
  border-radius: 18px;
  padding: 34px 20px;
  text-align: center;
  cursor: pointer;
}

.upload__drop--active {
  background: #e7f4ea;
}

.upload__cloud {
  display: block;
  font-size: 34px;
  color: #397653;
}

.upload__drop-title {
  margin: 10px 0 0;
  font-weight: 700;
  font-size: 16px;
}

.upload__drop-hint {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 13px;
}

.upload__file {
  margin: 12px 0 0;
  color: #397653;
  font-size: 14px;
  font-weight: 700;
}

.upload__flow {
  margin: 18px 0 0;
  color: #77847c;
  font-size: 13px;
}

.upload__grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.upload__field {
  border: 0;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.upload__field--wide {
  grid-column: 1 / -1;
}

.upload__field span,
.upload__field legend {
  color: #77847c;
  font-size: 12px;
  font-weight: 700;
  padding: 0;
}

.upload__field input[type="text"],
.upload__field input[type="number"],
.upload__field textarea,
.upload__topic-add input {
  border: 1px solid #dee8db;
  border-radius: 12px;
  padding: 11px 12px;
  font: inherit;
  font-size: 14px;
  color: #34423b;
  background: #fff;
  width: 100%;
}

.upload__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.upload__chip {
  border: 1px solid #dee8db;
  background: #fff;
  border-radius: 14px;
  padding: 8px 12px 6px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  color: #34423b;
  cursor: pointer;
}

.upload__chip--on {
  background: #d9f1e1;
  border-color: #397653;
  color: #397653;
}

.upload__topic-add {
  display: flex;
  gap: 8px;
}

.upload__topic-add button {
  border: 1px solid #397653;
  background: #fff;
  color: #397653;
  border-radius: 12px;
  padding: 8px 12px;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
}

.upload__ages {
  display: flex;
  align-items: center;
  gap: 8px;
}

.upload__ages input {
  width: 70px;
}

.upload__unit {
  color: #77847c;
  font-size: 13px;
}

.upload__segmented {
  display: flex;
  gap: 8px;
}

.upload__segmented button {
  border: 1px solid #dee8db;
  background: #fff;
  border-radius: 12px;
  padding: 9px 16px;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  color: #34423b;
  cursor: pointer;
}

.upload__seg--on {
  background: #d9f1e1;
  border-color: #397653;
  color: #397653;
}

.upload__price {
  max-width: 220px;
  margin-top: 8px;
}

.upload__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 22px;
}

.upload__primary,
.upload__secondary {
  border: 0;
  border-radius: 15px;
  padding: 13px 18px;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
  display: inline-block;
}

.upload__primary {
  background: #397653;
  color: #fff;
}

.upload__secondary {
  background: #d9f1e1;
  color: #397653;
}

.upload__primary:disabled,
.upload__secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.upload__error {
  margin: 16px 0 0;
  color: #b3261e;
  font-size: 14px;
}

.upload__confirm-title {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
}

.upload__checks {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 15px;
}

.upload__check--missing {
  color: #b3261e;
}

.upload__done {
  margin: 0;
  font-size: 16px;
  display: flex;
  gap: 10px;
  align-items: center;
}

@media (max-width: 640px) {
  .upload__card {
    padding: 22px 18px;
  }

  .upload__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
