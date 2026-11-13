<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ChevronLeft, ChevronRight, SearchX } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BookFilters from '../components/books/BookFilters.vue'
import BookGrid from '../components/books/BookGrid.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { categories } from '../data/categories'
import {
  createLibraryFilters,
  filterBooks,
  type LibraryFilters,
} from '../composables/useBooks'
import { useCatalog } from '../composables/useCatalog'
import type { Book } from '../data/books'
const route = useRoute()
const router = useRouter()

const categoryFromQuery = () => {
  const slug = typeof route.query.category === 'string' ? route.query.category : ''
  return categories.find((category) => category.slug === slug)?.name ?? 'all'
}

// Books and bundles come back in one catalog request and share one grid.
const { books: catalogBooks, loading, error, reload } = useCatalog('all')

const kind = ref<'all' | 'book' | 'bundle'>('all')
const kindOf = (book: Book) => book.kind ?? 'book'
const kindOptions = [
  { value: 'all', label: 'Tất cả' },
  { value: 'book', label: 'Sách lẻ' },
  { value: 'bundle', label: 'Gói sách' },
] as const
const filters = ref<LibraryFilters>(createLibraryFilters(categoryFromQuery()))
const scopedBooks = computed(() =>
  kind.value === 'all'
    ? catalogBooks.value
    : catalogBooks.value.filter((book) => kindOf(book) === kind.value),
)
const filteredBooks = computed(() => filterBooks(filters.value, scopedBooks.value))

const BOOKS_PER_PAGE = 10
const currentPage = ref(1)
const pageCount = computed(() => Math.ceil(filteredBooks.value.length / BOOKS_PER_PAGE))
const paginatedBooks = computed(() => {
  const start = (currentPage.value - 1) * BOOKS_PER_PAGE
  return filteredBooks.value.slice(start, start + BOOKS_PER_PAGE)
})
const paginationPages = computed(() => {
  const total = pageCount.value
  if (total <= 5) return Array.from({ length: total }, (_, index) => index + 1)

  const start = Math.max(2, currentPage.value - 1)
  const end = Math.min(total - 1, currentPage.value + 1)
  return [1, ...(start > 2 ? [null] : []), ...Array.from({ length: end - start + 1 }, (_, index) => start + index), ...(end < total - 1 ? [null] : []), total]
})

const setPage = (page: number) => {
  currentPage.value = page
}

watch(filteredBooks, () => {
  currentPage.value = 1
})
const updateFilters = (value: LibraryFilters) => {
  const categoryChanged = value.category !== filters.value.category
  filters.value = value

  if (!categoryChanged) return

  const slug =
    value.category === 'all'
      ? undefined
      : categories.find((category) => category.name === value.category)?.slug
  const query = { ...route.query }

  if (slug) query.category = slug
  else delete query.category

  void router.replace({ query })
}

const resetFilters = () => {
  filters.value = createLibraryFilters()
  const query = { ...route.query }
  delete query.category
  void router.replace({ query })
}

watch(
  () => route.query.category,
  () => {
    const category = categoryFromQuery()
    if (category !== filters.value.category) {
      filters.value = { ...filters.value, category }
    }
  },
)
</script>

<template>
  <div class="library-page">
    <AppHeader variant="overlay" contrast="dark" />

    <main class="library-content">
      <section class="library-section" aria-labelledby="library-title">
        <div class="library-heading">
          <div>
            <h1 id="library-title">Một thế giới sách nhỏ xinh</h1>
            <p>Chọn một cuốn sách để xem nội dung và bắt đầu đọc</p>
          </div>
        </div>

        <div class="library-kinds" role="tablist" aria-label="Loại sản phẩm">
          <button
            v-for="option in kindOptions"
            :key="option.value"
            class="library-kinds__pill"
            :class="{ 'library-kinds__pill--active': kind === option.value }"
            type="button"
            role="tab"
            :aria-selected="kind === option.value"
            @click="kind = option.value"
          >
            {{ option.label }}
          </button>
        </div>


        <BookFilters
          :model-value="filters"
          :categories="categories"
          @update:model-value="updateFilters"
          @reset="resetFilters"
        />

        <p class="sr-only" aria-live="polite">
          {{ filteredBooks.length }} nội dung phù hợp
        </p>

        <div v-if="loading" class="library-empty" role="status">
          <p>Đang tải thư viện…</p>
        </div>

        <div v-else-if="error" class="library-empty" role="alert">
          <h2>Chưa kết nối được thư viện</h2>
          <p>{{ error }}</p>
          <BaseButton variant="secondary" @click="reload">Thử lại</BaseButton>
        </div>

        <BookGrid
          v-else-if="paginatedBooks.length"
          :books="paginatedBooks"
          variant="library"
        />
        <div v-else-if="!catalogBooks.length" class="library-empty">
          <h2>Thư viện đang được cập nhật</h2>
          <p>Sách mới sẽ xuất hiện ở đây ngay khi được xuất bản.</p>
        </div>
        <div v-else class="library-empty">
          <span class="library-empty__icon" aria-hidden="true">
            <SearchX :size="38" />
          </span>
          <h2>Chưa tìm thấy nội dung nào</h2>
          <p>Thử một từ khóa khác hoặc đặt lại bộ lọc để xem tất cả sách và gói sách nhé.</p>
          <BaseButton variant="secondary" @click="resetFilters">
            Đặt lại bộ lọc
          </BaseButton>
        </div>
        <nav v-if="filteredBooks.length" class="library-pagination" aria-label="Phân trang thư viện">
          <button
            class="library-pagination__button"
            type="button"
            :disabled="currentPage === 1"
            @click="setPage(currentPage - 1)"
          >
            <ChevronLeft :size="18" aria-hidden="true" />
            <span class="sr-only">Trang trước</span>
          </button>
          <template v-for="(page, index) in paginationPages" :key="`${page}-${index}`">
            <span v-if="page === null" class="library-pagination__ellipsis" aria-hidden="true">…</span>
            <button
              v-else
              class="library-pagination__button"
              :class="{ 'library-pagination__button--current': page === currentPage }"
              type="button"
              :aria-current="page === currentPage ? 'page' : undefined"
              @click="setPage(page)"
            >
              {{ page }}
            </button>
          </template>
          <button
            class="library-pagination__button"
            type="button"
            :disabled="currentPage === pageCount"
            @click="setPage(currentPage + 1)"
          >
            <ChevronRight :size="18" aria-hidden="true" />
            <span class="sr-only">Trang sau</span>
          </button>
        </nav>
      </section>

      <aside class="adult-banner" aria-labelledby="adult-title">
        <div class="adult-banner__content">
          <p class="adult-banner__eyebrow">DÀNH CHO PHỤ HUYNH &amp; GIÁO VIÊN</p>
          <h2 id="adult-title">Đồng hành cùng mỗi hành trình đọc của bé</h2>
          <p>Quản lý tủ sách, độ tuổi phù hợp và quyền truy cập nội dung trả phí.</p>
          <BaseButton to="/admin">Quản lý tủ sách <span aria-hidden="true">→</span></BaseButton>
        </div>
        <div class="adult-banner__art" aria-hidden="true">
          <img
            class="adult-banner__img"
            src="/images/cozy_bear_storytime_nook.png"
            alt=""
            loading="lazy"
          />
        </div>
      </aside>
    </main>

    <AppFooter label="Thư viện sách" />
  </div>
</template>
