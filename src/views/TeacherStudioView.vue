<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import UploadBookModal from '../components/studio/UploadBookModal.vue'
import EditBookModal from '../components/studio/EditBookModal.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import { useToast } from '../composables/useToast'

import { ApiError } from '../api/client'
import {
  getSales,
  listMyBooks,
  listTopics,
  publishBook,
  unpublishBook,
  type SalesItem,
  type SalesSummary,
  type SalesTotals,
  type TeacherBook,
} from '../api/teacher'
import type { Tag } from '../api/catalog'
import { useSession } from '../composables/useSession'

const session = useSession()

const books = ref<TeacherBook[]>([])
const topics = ref<Tag[]>([])
const loading = ref(true)
const error = ref('')
const topicsError = ref('')
const sales = ref<SalesSummary | null>(null)
const salesError = ref('')
const search = ref('')
const busyId = ref<number | null>(null)
const actionError = ref('')
const uploadOpen = ref(false)
const editing = ref<TeacherBook | null>(null)
const pendingToggle = ref<TeacherBook | null>(null)
const { message: toast, show: showToast } = useToast()

const noSales: SalesTotals = { orders: 0, revenue_vnd: 0, book_revenue_vnd: 0, bundle_revenue_vnd: 0 }
const noItem: SalesItem = { id: 0, sold: 0, revenue_vnd: 0 }

const salesTotals = computed(() => sales.value?.totals ?? noSales)

const salesByBook = computed(() => {
  const map = new Map<number, SalesItem>()
  for (const item of sales.value?.books ?? []) map.set(item.id, item)
  return map
})

// A book's own sales exclude bundle purchases: that money stays on the bundle.
const salesFor = (bookID: number) => salesByBook.value.get(bookID) ?? noItem

const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`

const load = async () => {
  loading.value = true
  error.value = ''
  topicsError.value = ''
  salesError.value = ''

  const [bookResult, topicResult, salesResult] = await Promise.allSettled([
    listMyBooks(),
    listTopics(),
    getSales(),
  ])

  if (bookResult.status === 'fulfilled') {
    books.value = bookResult.value
  } else {
    error.value = loadMessage(bookResult.reason)
  }

  if (topicResult.status === 'fulfilled') {
    topics.value = topicResult.value
  } else {
    // A topic list that failed must not look like "these books have no topic".
    topicsError.value = 'Không tải được danh sách chủ đề, cột Chủ đề có thể trống.'
  }

  if (salesResult.status === 'fulfilled') {
    sales.value = salesResult.value
  } else {
    // Zero revenue and a broken report look identical, so say it out loud.
    salesError.value = 'Không tải được số liệu bán hàng, các cột Đã bán và Doanh thu có thể trống.'
  }

  loading.value = false
}

onMounted(load)

const loadMessage = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Không tải được danh sách sách.'
  if (err.status === 401 || err.status === 403) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  }
  if (err.code === 'network') return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
  return 'Không tải được danh sách sách.'
}

const topicNames = (tagIds: number[]): string =>
  tagIds
    .map((id) => topics.value.find((topic) => topic.id === id)?.name)
    .filter((name): name is string => Boolean(name))
    .join(', ') || '—'

const filteredBooks = computed(() => {
  const needle = search.value.trim().toLowerCase()
  if (!needle) return books.value
  return books.value.filter((book) => book.title.toLowerCase().includes(needle))
})

const stats = computed(() => {
  const published = books.value.filter((book) => book.status === 'published').length
  return { total: books.value.length, published, drafts: books.value.length - published }
})

// The reason a status change was refused depends on which direction it went.
const actionMessage = (err: unknown, publishing: boolean): string => {
  if (!(err instanceof ApiError)) return 'Không đổi được trạng thái xuất bản.'

  switch (err.code) {
    case 'validation':
      return publishing
        ? 'Cần bìa, EPUB và mô tả trước khi xuất bản.'
        : 'Không thể hủy xuất bản vì sách đang nằm trong một gói đã xuất bản.'
    case 'not_found':
      return 'Không tìm thấy cuốn sách này.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không đổi được trạng thái xuất bản.'
  }
}

const toggleMessage = computed(() => {
  const book = pendingToggle.value
  if (!book) return ''
  return book.status === 'published'
    ? `“${book.title}” sẽ không còn hiển thị trong thư viện cho tới khi bạn xuất bản lại.`
    : `“${book.title}” sẽ hiển thị trong thư viện với thông tin và giá hiện tại.`
})

// Publishing or unpublishing changes what children can read, so it asks first.
const togglePublish = async (book: TeacherBook) => {
  if (busyId.value !== null) return
  pendingToggle.value = book
}

const confirmToggle = async () => {
  const book = pendingToggle.value
  pendingToggle.value = null
  if (!book || busyId.value !== null) return

  const publishing = book.status !== 'published'
  busyId.value = book.id
  actionError.value = ''

  try {
    const updated = publishing ? await publishBook(book.id) : await unpublishBook(book.id)
    books.value = books.value.map((item) => (item.id === updated.id ? updated : item))
    showToast(publishing ? 'Đã xuất bản sách.' : 'Đã hủy xuất bản sách.')
  } catch (err) {
    actionError.value = actionMessage(err, publishing)
  } finally {
    busyId.value = null
  }
}

const greetingName = computed(() => session.user.value?.display_name ?? '')
// The modal already validated and saved; patch the row instead of refetching the list.
const onSaved = (updated: TeacherBook) => {
  books.value = books.value.map((item) => (item.id === updated.id ? updated : item))
  editing.value = null

  // The modal can create a topic, so the page's tag names need refreshing to show it.
  listTopics()
    .then((tags) => (topics.value = tags))
    .catch(() => {})
}
</script>

<template>
  <div class="studio">
    <AppHeader />

    <div class="studio__shell">
      <header class="studio__header">
        <nav class="studio__breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <span>Teacher Studio</span>
        </nav>
        <p class="studio__eyebrow">
          <Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY
        </p>
        <h1 class="studio__title">Teacher Studio</h1>
        <p class="studio__greeting">Xin chào, {{ greetingName }} 👋</p>
      </header>

      <div class="studio__layout">
        <nav class="studio__sidebar" aria-label="Không gian giáo viên">
          <p class="studio__sidebar-title">KHÔNG GIAN GIÁO VIÊN</p>
          <RouterLink class="studio__nav" to="/studio">▦ Tổng quan</RouterLink>
          <RouterLink class="studio__nav studio__nav--active" to="/studio">
            📚 Sách của tôi
          </RouterLink>
          <button type="button" class="studio__nav studio__nav--button" @click="uploadOpen = true">＋ Tải sách EPUB</button>
          <RouterLink class="studio__nav" to="/studio/bundles">◈ Gói sách</RouterLink>
          <span class="studio__nav studio__nav--muted">⚙ Hồ sơ &amp; cài đặt</span>
        </nav>

        <main class="studio__main">
          <h2>Sách của tôi</h2>
          <p class="studio__subtitle">Tải lên, chỉnh sửa và tự xuất bản sách của bạn.</p>

          <div class="studio__stats">
            <div class="studio__stat studio__stat--mint">
              <p class="studio__stat-value">{{ stats.total }}</p>
              <p class="studio__stat-label">Tổng số sách</p>
            </div>
            <div class="studio__stat studio__stat--sky">
              <p class="studio__stat-value">{{ stats.published }}</p>
              <p class="studio__stat-label">Đã xuất bản</p>
            </div>
            <div class="studio__stat studio__stat--butter">
              <p class="studio__stat-value">{{ stats.drafts }}</p>
              <p class="studio__stat-label">Bản nháp</p>
            </div>
          </div>

          <!-- Money comes from paid orders only: a bundle's revenue stays on the bundle,
               never split onto the books inside it. -->
          <p v-if="salesError" class="studio__hint studio__hint--warning" role="alert">
            <span>{{ salesError }}</span>
          </p>

          <div class="studio__stats studio__stats--money">
            <div class="studio__stat studio__stat--mint">
              <p class="studio__stat-value">{{ money(salesTotals.revenue_vnd) }}</p>
              <p class="studio__stat-label">
                Tổng doanh thu · {{ salesTotals.orders }} lượt mua
              </p>
            </div>
            <div class="studio__stat studio__stat--sky">
              <p class="studio__stat-value">{{ money(salesTotals.book_revenue_vnd) }}</p>
              <p class="studio__stat-label">Doanh thu sách lẻ</p>
            </div>
            <div class="studio__stat studio__stat--butter">
              <p class="studio__stat-value">{{ money(salesTotals.bundle_revenue_vnd) }}</p>
              <p class="studio__stat-label">Doanh thu gói sách</p>
            </div>
          </div>

          <div class="studio__toolbar">
            <label class="studio__search">
              <span class="sr-only">Tìm theo tên sách</span>
              <input v-model="search" type="search" placeholder="⌕  Tìm theo tên sách…" />
            </label>
            <button type="button" class="studio__primary" @click="uploadOpen = true">
              ＋ Tải sách mới
            </button>
          </div>

          <p v-if="actionError" class="studio__state studio__state--error" role="alert">
            {{ actionError }}
          </p>

          <p v-if="topicsError" class="studio__state studio__state--warning" role="status">
            {{ topicsError }}
            <button type="button" class="studio__action" @click="load">Thử lại</button>
          </p>

          <p v-if="loading" class="studio__state" role="status">Đang tải sách…</p>

          <p v-else-if="error" class="studio__state studio__state--error" role="alert">
            {{ error }}
            <button type="button" class="studio__action" @click="load">Thử lại</button>
          </p>

          <div v-else-if="!books.length" class="studio__state">
            <h2>Chưa có cuốn sách nào</h2>
            <p>Tải lên EPUB đầu tiên để bắt đầu xây thư viện của bạn.</p>
            <button type="button" class="studio__primary" @click="uploadOpen = true">＋ Tải sách mới</button>
          </div>

          <template v-else>
            <div class="studio__table-wrap">
              <table class="studio__table">
                <caption class="sr-only">Danh sách sách của bạn</caption>
                <thead>
                  <tr>
                    <th scope="col">SÁCH</th>
                    <th scope="col">CHỦ ĐỀ</th>
                    <th scope="col">TRẠNG THÁI</th>
                    <th scope="col">ĐÃ BÁN</th>
                    <th scope="col">DOANH THU</th>
                    <th scope="col">THAO TÁC</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="book in filteredBooks" :key="book.id">
                    <td>
                      <RouterLink class="studio__book" :to="`/studio/books/${book.id}`">
                        {{ book.title }}
                      </RouterLink>
                    </td>
                    <td class="studio__cell">{{ topicNames(book.tag_ids) }}</td>
                    <td>
                      <span
                        class="studio__chip"
                        :class="
                          book.status === 'published'
                            ? 'studio__chip--published'
                            : 'studio__chip--draft'
                        "
                      >
                        {{ book.status === 'published' ? 'Đã xuất bản' : 'Bản nháp' }}
                      </span>
                    </td>
                    <td class="studio__cell">
                      {{ salesFor(book.id).sold }}
                    </td>
                    <td class="studio__cell">{{ money(salesFor(book.id).revenue_vnd) }}</td>
                    <td>
                      <span class="studio__actions">
                        <button
                          type="button"
                          class="studio__action"
                          :aria-label="`Sửa ${book.title}`"
                          @click="editing = book"
                        >
                          Sửa
                        </button>
                        <RouterLink
                          class="studio__action"
                          :to="`/studio/books/${book.id}`"
                          :aria-label="`Thay tệp cho ${book.title}`"
                        >
                          Tệp
                        </RouterLink>
                        <button
                          type="button"
                          class="studio__action"
                          :disabled="busyId !== null"
                          :aria-label="`${book.status === 'published' ? 'Hủy xuất bản' : 'Xuất bản'} ${book.title}`"
                          @click="togglePublish(book)"
                        >
                          {{
                            busyId === book.id
                              ? '…'
                              : book.status === 'published'
                                ? 'Hủy xuất bản'
                                : 'Xuất bản'
                          }}
                        </button>
                        <RouterLink
                          v-if="book.status === 'published'"
                          class="studio__action"
                          :to="`/books/${book.slug}`"
                          :aria-label="`Xem ${book.title} ở thư viện`"
                        >
                          Xem
                        </RouterLink>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p v-if="!filteredBooks.length" class="studio__state">
              Không tìm thấy sách khớp “{{ search }}”.
            </p>
          </template>

          <aside class="studio__hint">
            <span aria-hidden="true">☁</span>
            <p>Hỗ trợ sách tương tác, âm thanh, hình ảnh và thông tin giáo dục.</p>
          </aside>
        </main>
      </div>
    </div>
  </div>
    <UploadBookModal
      :open="uploadOpen"
      @close="uploadOpen = false"
      @saved="load"
    />
    <ConfirmDialog
      :open="Boolean(pendingToggle)"
      :title="pendingToggle?.status === 'published' ? 'Hủy xuất bản sách này?' : 'Xuất bản sách này?'"
      :message="toggleMessage"
      :confirm-label="pendingToggle?.status === 'published' ? 'Hủy xuất bản' : 'Xuất bản'"
      @confirm="confirmToggle"
      @cancel="pendingToggle = null"
    />
    <AppToast :message="toast" />
    <EditBookModal
      :open="Boolean(editing)"
      :book="editing"
      @close="editing = null"
      @saved="onSaved"
    />
</template>

<style scoped>
.studio {
  min-height: 100vh;
  background: #fff8ec;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.studio__shell {
  max-width: 1440px;
  margin: 0 auto;
  padding: 24px 40px 36px;
}

/* Same block shape and type scale as the About page header: breadcrumb, brand eyebrow,
   page title, then one line of muted context — no card wrapping it. */
.studio__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.studio__breadcrumb {
  display: flex;
  gap: 16px;
  color: #77847c;
  font-size: 14px;
}

.studio__breadcrumb a:hover {
  color: #397653;
}

.studio__eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.78px;
}

.studio__title {
  margin: 0;
  color: #2e4a38;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.12;
}

.studio__greeting {
  margin: 0;
  color: #77847c;
  font-size: 15px;
}

.studio__layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.studio__sidebar {
  background: #fff;
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-self: start;
}

.studio__sidebar-title {
  margin: 0;
  color: #77847c;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.studio__nav--button {
  border: 0;
  background: transparent;
  text-align: left;
  cursor: pointer;
  padding: 0;
  font: inherit;
}

.studio__nav {

  color: #34423b;
  font-size: 15px;
  text-decoration: none;
}

.studio__nav--active {
  color: #397653;
  font-weight: 700;
}

.studio__nav--muted {
  color: #a49c93;
}

.studio__main > h2 {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
}

.studio__subtitle {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 15px;
}

.studio__stats {
  display: flex;
  gap: 14px;
  margin-top: 18px;
  flex-wrap: wrap;
}

.studio__stat {
  border-radius: 18px;
  padding: 18px;
  min-width: 190px;
  flex: 1 1 190px;
}

.studio__stat--mint {
  background: #d9f1e1;
}

.studio__stat--sky {
  background: #d9eefc;
}

.studio__stat--butter {
  background: #ffe8af;
}

.studio__stat-value {
  margin: 0;
  font-size: 30px;
  font-weight: 700;
}

.studio__stat-label {
  margin: 8px 0 0;
  font-size: 13px;
}

.studio__toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  margin-top: 18px;
  flex-wrap: wrap;
}

.studio__search {
  flex: 1 1 240px;
}

.studio__search input {
  width: 100%;
  border: 1px solid #e5e5d9;
  border-radius: 16px;
  background: #fff;
  padding: 13px 16px;
  font: inherit;
  font-size: 14px;
  color: #34423b;
}

.studio__primary {
  border: 0;
  cursor: pointer;
  font-family: inherit;
  background: #397653;
  color: #fff;
  border-radius: 16px;
  padding: 14px 18px;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  display: inline-block;
}

.studio__table-wrap {
  background: #fff;
  border-radius: 18px;
  margin-top: 18px;
  overflow-x: auto;
}

.studio__table {
  width: 100%;
  border-collapse: collapse;
  min-width: 620px;
}

.studio__table th {
  text-align: left;
  color: #77847c;
  font-size: 13px;
  font-weight: 700;
  padding: 14px;
}

.studio__table td {
  padding: 14px;
  vertical-align: middle;
}

.studio__table tbody tr + tr td {
  border-top: 1px solid #f3efe4;
}

.studio__book {
  color: #34423b;
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
}

.studio__book:hover {
  text-decoration: underline;
}

.studio__cell {
  color: #77847c;
  font-size: 13px;
}

.studio__chip {
  display: inline-block;
  border-radius: 14px;
  padding: 10px 12px;
  font-size: 13px;
  font-weight: 700;
  color: #397653;
}

.studio__chip--published {
  background: #d9f1e1;
}

.studio__chip--draft {
  background: #ffe8af;
}

.studio__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.studio__action {
  border: 0;
  background: transparent;
  color: #397653;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  padding: 0;
  text-decoration: none;
}

.studio__action:disabled {
  color: #a49c93;
  cursor: progress;
}

.studio__state {
  background: #fff;
  border-radius: 18px;
  padding: 22px;
  margin-top: 18px;
  color: #34423b;
}

.studio__state--error {
  color: #b3261e;
}

.studio__state--warning {
  color: #8a6d1f;
}

.studio__hint {
  display: flex;
  gap: 12px;
  align-items: center;
  background: #e8e2fb;
  border-radius: 18px;
  padding: 16px;
  margin-top: 18px;
  font-size: 14px;
}

.studio__hint p {
  margin: 0;
}

@media (max-width: 900px) {
  .studio__shell {
    padding: 16px;
  }

  .studio__title {
    font-size: 32px;
  }

  .studio__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .studio__sidebar {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Each nav item keeps its own line: wrapping them inline reads as one run-on label. */
  .studio__nav {
    flex: 1 1 100%;
  }

  .studio__stat {
    flex: 1 1 calc(33% - 10px);
    min-width: 0;
  }

  .studio__stat-value {
    font-size: 22px;
  }

  /* Amounts are much wider than a count, so their row wraps two per line instead of
     squeezing three cards into a phone's width. */
  .studio__stats--money .studio__stat {
    flex: 1 1 calc(50% - 7px);
  }

  /* Topic and the money column are secondary on a phone: the total above already says
     how much came in, so the row keeps its sale count and its actions. */
  .studio__table th:nth-child(2),
  .studio__table td:nth-child(2),
  .studio__table th:nth-child(5),
  .studio__table td:nth-child(5) {
    display: none;
  }

  .studio__table {
    min-width: 0;
  }

  .studio__chip {
    white-space: nowrap;
  }
}
</style>
