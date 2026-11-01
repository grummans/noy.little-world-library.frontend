<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { ApiError } from '../api/client'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import { useToast } from '../composables/useToast'
import {
  getMyBook,
  publishBook,
  replaceBookFiles,
  unpublishBook,
  type TeacherBook,
} from '../api/teacher'

const route = useRoute()
const router = useRouter()
const bookId = Number(route.params.id)

const book = ref<TeacherBook | null>(null)
const loading = ref(true)
const loadError = ref('')
const statusBusy = ref(false)
const statusError = ref('')

const epubFile = ref<File | null>(null)
const coverFile = ref<File | null>(null)
const epubInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const filesBusy = ref(false)
const filesMessage = ref('')
const filesError = ref('')
const { message: toast, show: showToast } = useToast()
const pendingAction = ref<'status' | 'files' | null>(null)

const isPublished = computed(() => book.value?.status === 'published')
const hasNewFiles = computed(() => Boolean(epubFile.value || coverFile.value))

const message = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'

  switch (err.code) {
    case 'invalid_file':
      return 'Tệp không hợp lệ: EPUB phải đúng chuẩn và bìa phải là ảnh JPG/PNG.'
    case 'validation':
      return 'Không thể đổi trạng thái: sách đang nằm trong một gói đã xuất bản.'
    case 'not_publishable':
      return 'Cần bìa, EPUB và mô tả trước khi xuất bản.'
    case 'not_found':
      return 'Không tìm thấy cuốn sách này, hoặc sách không thuộc tài khoản của bạn.'
    case 'storage_unavailable':
      return 'Máy chủ lưu trữ chưa sẵn sàng. Thử lại sau ít phút.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không lưu được thay đổi. Vui lòng thử lại.'
  }
}

onMounted(async () => {
  try {
    book.value = await getMyBook(bookId)
  } catch (err) {
    loadError.value = message(err)
  } finally {
    loading.value = false
  }
})

const pickEpub = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!file.name.toLowerCase().endsWith('.epub')) {
    filesError.value = 'Chỉ nhận tệp .epub.'
    return
  }
  // The server accepts 50 MB; checking here saves uploading a file it would reject.
  if (file.size > 50 * 1024 * 1024) {
    filesError.value = 'Tệp EPUB tối đa 50 MB.'
    return
  }
  filesError.value = ''
  epubFile.value = file
}

const pickCover = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  const looksImage = /^image\/(jpeg|png)$/.test(file.type) || /\.(jpe?g|png)$/i.test(file.name)
  if (!looksImage) {
    filesError.value = 'Bìa phải là ảnh JPG hoặc PNG.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    filesError.value = 'Bìa tối đa 5 MB.'
    return
  }
  filesError.value = ''
  coverFile.value = file
}

const saveFiles = async () => {
  pendingAction.value = null
  if (!book.value || filesBusy.value || !hasNewFiles.value) return

  filesBusy.value = true
  filesMessage.value = ''
  filesError.value = ''
  try {
    book.value = await replaceBookFiles(book.value.id, {
      epub: epubFile.value,
      cover: coverFile.value,
    })
    epubFile.value = null
    coverFile.value = null
    filesMessage.value = 'Đã cập nhật tệp cho sách.'
    showToast('Đã cập nhật tệp cho sách.')
  } catch (err) {
    filesError.value = message(err)
  } finally {
    filesBusy.value = false
  }
}

const toggleStatus = async () => {
  pendingAction.value = null
  if (!book.value || statusBusy.value) return

  const publishing = book.value.status !== 'published'
  statusBusy.value = true
  statusError.value = ''
  try {
    book.value = publishing ? await publishBook(book.value.id) : await unpublishBook(book.value.id)
    showToast(publishing ? 'Đã xuất bản sách.' : 'Đã hủy xuất bản sách.')
  } catch (err) {
    statusError.value = message(err)
  } finally {
    statusBusy.value = false
  }
}

const backToStudio = () => void router.push('/studio')
</script>

<template>
  <div class="edit">
    <div class="edit__shell">
      <header class="edit__top">
        <RouterLink class="edit__back" to="/studio">← Sách của tôi</RouterLink>
        <p class="edit__brand">Little Wonder / Teacher Studio</p>
      </header>

      <p v-if="loading" class="edit__state" role="status">Đang tải sách…</p>

      <p v-else-if="loadError" class="edit__state edit__state--error" role="alert">
        {{ loadError }}
        <button type="button" class="edit__link" @click="backToStudio">Về danh sách</button>
      </p>

      <section v-else-if="book" class="edit__card">
        <div class="edit__head">
          <div>
            <h1>Tệp sách</h1>
            <p class="edit__subtitle">
              {{ book.title }} ·
              <span class="edit__chip" :class="isPublished ? 'edit__chip--on' : 'edit__chip--draft'">
                {{ isPublished ? 'Đã xuất bản' : 'Bản nháp' }}
              </span>
            </p>
          </div>
          <div class="edit__head-actions">
            <RouterLink v-if="isPublished" class="edit__secondary" :to="`/books/${book.slug}`">
              Xem trong thư viện
            </RouterLink>
            <button type="button" class="edit__primary" :disabled="statusBusy" @click="pendingAction = 'status'">
              {{ statusBusy ? '…' : isPublished ? 'Hủy xuất bản' : 'Xuất bản' }}
            </button>
          </div>
        </div>

        <p v-if="statusError" class="edit__error" role="alert">{{ statusError }}</p>

        <ul class="edit__files">
          <li>
            {{ book.has_epub ? '✓ EPUB đã có' : '! Chưa có EPUB' }}
            <span v-if="book.page_count"> · {{ book.page_count }} trang</span>
            <span v-if="book.has_audio"> · có âm thanh</span>
            <span v-if="book.has_video"> · có video</span>
          </li>
          <li>{{ book.has_cover ? '✓ Ảnh bìa đã có' : '! Chưa có ảnh bìa' }}</li>
        </ul>

        <div class="edit__field">
          <span>Thay EPUB (tùy chọn)</span>
          <input
            ref="epubInput"
            class="sr-only"
            type="file"
            accept=".epub,application/epub+zip"
            aria-label="Tệp EPUB mới"
            @change="pickEpub"
          />
          <button type="button" class="edit__secondary" @click="epubInput?.click()">
            {{ epubFile ? 'Chọn tệp khác' : 'Chọn EPUB mới' }}
          </button>
          <p v-if="epubFile" class="edit__note">✓ {{ epubFile.name }}</p>
        </div>

        <div class="edit__field">
          <span>Thay ảnh bìa (tùy chọn)</span>
          <input
            ref="coverInput"
            class="sr-only"
            type="file"
            accept="image/jpeg,image/png"
            aria-label="Ảnh bìa mới"
            @change="pickCover"
          />
          <button type="button" class="edit__secondary" @click="coverInput?.click()">
            {{ coverFile ? 'Chọn ảnh khác' : 'Chọn ảnh bìa mới' }}
          </button>
          <p v-if="coverFile" class="edit__note">✓ {{ coverFile.name }}</p>
        </div>

        <p v-if="filesError" class="edit__error" role="alert">{{ filesError }}</p>
        <p v-else-if="filesMessage" class="edit__success" role="status">{{ filesMessage }}</p>

        <button
          type="button"
          class="edit__primary"
          :disabled="filesBusy || !hasNewFiles"
          @click="pendingAction = 'files'"
        >
          {{ filesBusy ? 'Đang tải lên…' : 'Cập nhật tệp' }}
        </button>
        <p class="edit__note">
          Thay tệp giữ nguyên thông tin sách. Sách đã xuất bản sẽ hiển thị tệp mới ngay. Sửa
          tên, mô tả, chủ đề hay giá ở nút “Sửa” trong danh sách sách.
        </p>
      </section>

      <ConfirmDialog
        :open="pendingAction !== null"
        :title="pendingAction === 'files' ? 'Cập nhật tệp cho sách?' : isPublished ? 'Hủy xuất bản sách này?' : 'Xuất bản sách này?'"
        :message="pendingAction === 'files' ? 'Tệp mới sẽ thay ngay tệp cũ mà người đọc đang thấy.' : isPublished ? 'Sách sẽ không còn hiển thị trong thư viện cho tới khi bạn xuất bản lại.' : 'Sách sẽ hiển thị trong thư viện với thông tin và giá hiện tại.'"
        :confirm-label="pendingAction === 'files' ? 'Cập nhật tệp' : isPublished ? 'Hủy xuất bản' : 'Xuất bản'"
        @confirm="pendingAction === 'files' ? saveFiles() : toggleStatus()"
        @cancel="pendingAction = null"
      />
      <AppToast :message="toast" />
    </div>
  </div>
</template>

<style scoped>
.edit {
  min-height: 100vh;
  background: #fff8ec;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.edit__shell {
  max-width: 820px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}

.edit__top {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
  background: #fff;
  border-radius: 18px;
  padding: 18px;
}

.edit__brand {
  margin: 0;
  color: #397653;
  font-weight: 700;
  font-size: 21px;
}

.edit__back {
  color: #397653;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.edit__card {
  margin-top: 20px;
  background: #fff;
  border-radius: 20px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.edit__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.edit__head h1 {
  margin: 0;
  font-size: 28px;
}

.edit__head-actions {
  display: flex;
  gap: 10px;
  align-items: center;
}

.edit__subtitle {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 14px;
}

.edit__chip {
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
  font-size: 12px;
}

.edit__chip--on {
  background: #d9f1e1;
  color: #397653;
}

.edit__chip--draft {
  background: #ffe8b0;
  color: #6b4b12;
}

.edit__field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.edit__field > span {
  color: #77847c;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.edit__files {
  margin: 0;
  padding-left: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
}

.edit__primary,
.edit__secondary {
  align-self: flex-start;
  border-radius: 15px;
  padding: 12px 22px;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}

.edit__primary {
  border: 0;
  background: #397653;
  color: #fff;
}

.edit__secondary {
  border: 1px solid #dee8db;
  background: #f5faf2;
  color: #397653;
}

.edit__primary:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.edit__error {
  margin: 0;
  color: #b3261e;
  font-size: 14px;
  font-weight: 700;
}

.edit__success {
  margin: 0;
  color: #397653;
  font-size: 14px;
  font-weight: 700;
}

.edit__note {
  margin: 0;
  color: #77847c;
  font-size: 13px;
}

.edit__state {
  margin-top: 24px;
  background: #fff;
  border-radius: 18px;
  padding: 20px;
  font-size: 15px;
}

.edit__state--error {
  color: #b3261e;
}

.edit__link {
  border: 0;
  background: none;
  color: #397653;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  margin-left: 8px;
}
</style>
