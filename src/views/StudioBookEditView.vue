<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import { ApiError } from '../api/client'
import AppHeader from '../components/app/AppHeader.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import ResultDialog from '../components/app/ResultDialog.vue'
import StudioSidebar from '../components/studio/StudioSidebar.vue'
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
// Publishing changes what parents can see, so it is acknowledged in a dialog rather
// than a toast that slides away.
const success = ref<{ title: string; message?: string } | null>(null)
const failure = ref<{ title: string; message?: string } | null>(null)
const loading = ref(true)
const loadError = ref('')
const statusBusy = ref(false)

const epubFile = ref<File | null>(null)
const coverFile = ref<File | null>(null)
const epubInput = ref<HTMLInputElement | null>(null)
const coverInput = ref<HTMLInputElement | null>(null)
const filesBusy = ref(false)
const filesError = ref('')
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
  filesError.value = ''
  failure.value = null
  try {
    book.value = await replaceBookFiles(book.value.id, {
      epub: epubFile.value,
      cover: coverFile.value,
    })
    epubFile.value = null
    coverFile.value = null
    success.value = { title: 'Đã cập nhật tệp cho sách', message: 'Bản EPUB và ảnh bìa mới đã được lưu.' }
  } catch (err) {
    failure.value = { title: 'Chưa cập nhật được tệp sách', message: message(err) }
  } finally {
    filesBusy.value = false
  }
}

const toggleStatus = async () => {
  pendingAction.value = null
  if (!book.value || statusBusy.value) return

  const publishing = book.value.status !== 'published'
  statusBusy.value = true
  failure.value = null
  try {
    book.value = publishing ? await publishBook(book.value.id) : await unpublishBook(book.value.id)
    success.value = publishing
      ? { title: 'Đã xuất bản sách', message: 'Sách đã có trong Thư viện công khai.' }
      : { title: 'Đã hủy xuất bản sách', message: 'Sách trở về trạng thái nháp, chỉ bạn nhìn thấy.' }
  } catch (err) {
    failure.value = { title: 'Chưa đổi được trạng thái sách', message: message(err) }
  } finally {
    statusBusy.value = false
  }
}

const backToStudio = () => void router.push('/studio')
</script>

<template>
  <div class="edit">
    <AppHeader />
    <div class="edit__shell">
      <header class="edit__top">
        <nav class="edit__breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink to="/studio">Teacher Studio</RouterLink>
          <span aria-hidden="true">/</span>
          <span>Tệp sách</span>
        </nav>
        <p class="edit__eyebrow">
          <Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY
        </p>
        <h1 class="edit__title">Tệp sách</h1>
      </header>

      <div class="edit__layout">
        <StudioSidebar />
        <main class="edit__main">

      <p v-if="loading" class="edit__state" role="status">Đang tải sách…</p>

      <p v-else-if="loadError" class="edit__state edit__state--error" role="alert">
        {{ loadError }}
        <button type="button" class="edit__link" @click="backToStudio">Về danh sách</button>
      </p>

      <section v-else-if="book" class="edit__card">
        <div class="edit__head">
          <div>
            <h2>{{ book.title }}</h2>
            <p class="edit__subtitle">
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
      <ResultDialog
        :open="Boolean(success)"
        :title="success?.title ?? ''"
        :message="success?.message"
        @close="success = null"
      />
      <ResultDialog
        :open="Boolean(failure)"
        tone="error"
        :title="failure?.title ?? ''"
        :message="failure?.message"
        @close="failure = null"
      />
        </main>
      </div>
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
  /* Wide enough for the sidebar plus the card it used to fill on its own. */
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}

/* Same two-column skeleton as the Teacher Studio screens that already had a sidebar. */
.edit__layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 20px;
  margin-top: 24px;
}

/* Same block shape and type scale as the About page header: breadcrumb, brand eyebrow,
   page title, then one line of muted context — no card wrapping it. */
.edit__top {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.edit__breadcrumb {
  display: flex;
  gap: 16px;
  color: #77847c;
  font-size: 14px;
}

.edit__breadcrumb a:hover {
  color: #397653;
}

.edit__eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.78px;
}

.edit__title {
  margin: 0;
  color: #2e4a38;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.12;
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

.edit__head h2 {
  margin: 0;
  font-size: 24px;
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
  padding: 3px 10px 1px;
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
@media (max-width: 1024px) {
  .edit__layout {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
