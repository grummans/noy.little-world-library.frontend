(card.tag_slugs[0] && tagNames.value.get(card.tag_slugs[0])) || ''const topicOf = (card: { tag_slugs: string[] }) =>
  (card.tag_slugs[0] && tagNames.value.get(card.tag_slugs[0])) || ''<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { ApiError } from '../api/client'
import { listTags } from '../api/catalog'
import { getShelf, type Shelf } from '../api/library'
import { tagNameLookup } from '../api/adapt'

type Tab = 'all' | 'books' | 'bundles'

const shelf = ref<Shelf | null>(null)
const tagNames = ref<Map<string, string>>(new Map())
const loading = ref(true)
const error = ref('')
const tab = ref<Tab>('all')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    const [data, tags] = await Promise.all([getShelf(), listTags().catch(() => [])])
    shelf.value = data
    tagNames.value = tagNameLookup(tags)
  } catch (err) {
    error.value =
      err instanceof ApiError ? err.message : 'Không tải được tủ sách của bé.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const topicOf = (card: { tag_slugs: string[] }) =>
  (card.tag_slugs[0] && tagNames.value.get(card.tag_slugs[0])) || ''

const readableItems = computed(() => {
  const all = shelf.value?.readable ?? []
  if (tab.value === 'books') return all.filter((item) => item.origin.type === 'purchase')
  if (tab.value === 'bundles') return all.filter((item) => item.origin.type === 'bundle')
  return all
})

const ownedBundles = computed(() =>
  tab.value === 'books' ? [] : (shelf.value?.bundles ?? []),
)
const ownedBooks = computed(() =>
  tab.value === 'bundles' ? [] : (shelf.value?.books ?? []),
)

const hasVisibleItems = computed(
  () =>
    readableItems.value.length +
      ownedBundles.value.length +
      ownedBooks.value.length >
    0,
)

const formatDate = (value: string | null) => {
  if (!value) return 'Đã mua'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Đã mua'
  return `Đã mua ${date.toLocaleDateString('vi-VN')}`
}

const tabs: { value: Tab; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'books', label: 'Sách lẻ' },
  { value: 'bundles', label: 'Gói sách' },
]
</script>

<template>
  <div class="shelf-page">
    <AppHeader variant="card" />

    <main class="shelf">
      <header class="shelf__intro">
        <h1>Tủ sách của bé</h1>
        <p>Những sách và gói sách bé đã có quyền đọc.</p>
      </header>

      <div class="shelf__tabs" role="group" aria-label="Lọc tủ sách">
        <button
          v-for="item in tabs"
          :key="item.value"
          type="button"
          :aria-pressed="tab === item.value"
          class="shelf__tab"
          :class="{ 'shelf__tab--active': tab === item.value }"
          @click="tab = item.value"
        >
          {{ item.label }}
        </button>
      </div>

      <p v-if="loading" class="shelf__state" role="status">Đang mở tủ sách…</p>

      <div v-else-if="error" class="shelf__state" role="alert">
        <p>{{ error }}</p>
        <BaseButton variant="secondary" @click="load">Thử lại</BaseButton>
      </div>

      <div v-else-if="!hasVisibleItems" class="shelf__state">
        <h2>{{ tab === "all" ? "Tủ sách đang trống" : "Mục này chưa có nội dung" }}</h2>
        <p>
          {{
            tab === "all"
              ? "Sau khi mua sách hoặc gói sách, bé sẽ thấy chúng ở đây."
              : "Thử chuyển sang tab khác, hoặc khám phá thêm sách mới."
          }}
        </p>
        <BaseButton to="/library">Khám phá thư viện</BaseButton>
      </div>

      <template v-else>
        <section
          v-if="readableItems.length"
          class="shelf__panel"
          aria-labelledby="readable-title"
        >
          <h2 id="readable-title">Sách bé có thể đọc</h2>
          <p class="shelf__hint">
            Gồm sách mua lẻ và sách trong gói đã mua. Lịch sử đọc sẽ có ở bước sau.
          </p>

          <ul class="continue-list">
            <li v-for="item in readableItems" :key="item.book.id" class="continue-card">
              <div>
                <p class="continue-card__title">{{ item.book.title }}</p>
                <p class="continue-card__origin">
                  <template v-if="item.origin.type === 'bundle'">
                    Thuộc gói {{ item.origin.bundle_name }}
                  </template>
                  <template v-else>
                    Sách lẻ<template v-if="topicOf(item.book)"> · {{ topicOf(item.book) }}</template>
                  </template>
                </p>
              </div>
              <RouterLink class="continue-card__action" :to="`/read/${item.book.slug}`">
                Mở sách
              </RouterLink>
            </li>
          </ul>
        </section>

        <section v-if="ownedBundles.length || ownedBooks.length" class="shelf__panel" aria-labelledby="owned-title">
          <h2 id="owned-title">Đã sở hữu</h2>
          <p class="shelf__hint">Gói sách giữ nguyên là sản phẩm đã mua.</p>

          <div class="owned-grid">
            <article
              v-for="bundle in ownedBundles"
              :key="`bundle-${bundle.id}`"
              class="owned-bundle"
            >
              <p class="owned-bundle__eyebrow">GÓI SÁCH ĐÃ MUA</p>
              <h3>{{ bundle.title }}</h3>
              <p class="owned-bundle__meta">
                {{ bundle.book_count ?? 0 }} sách trả phí · {{ formatDate(bundle.purchased_at) }}
              </p>
              <p class="owned-bundle__note">Mở gói để chọn từng sách và đọc.</p>
              <RouterLink class="owned-bundle__action" :to="`/bundles/${bundle.slug}`">
                Mở gói sách
              </RouterLink>
            </article>

            <article
              v-for="book in ownedBooks"
              :key="`book-${book.id}`"
              class="owned-book"
            >
              <h3>{{ book.title }}</h3>
              <p class="owned-book__meta">
                Sách lẻ<template v-if="topicOf(book)"> · {{ topicOf(book) }}</template>
              </p>
              <RouterLink class="owned-book__action" :to="`/read/${book.slug}`">
                Đọc ngay
              </RouterLink>
            </article>

            <aside class="owned-guidance">
              <h3>Quyền truy cập rõ ràng</h3>
              <p>
                Sách trong gói không lặp lại như sách lẻ ở Đã sở hữu; chúng chỉ hiện
                riêng khi bé đang đọc hoặc khi mở gói.
              </p>
            </aside>
          </div>
        </section>
      </template>
    </main>

    <AppFooter label="Tủ sách của bé" />
  </div>
</template>

<style scoped>
.shelf-page {
  min-height: 100vh;
  background: #fff8ec;
  font-family: "Nunito", system-ui, sans-serif;
}

.shelf {
  max-width: 1360px;
  margin: 0 auto;
  padding: 34px 40px 60px;
}

.shelf__intro h1 {
  margin: 0;
  color: #34423b;
  font-size: 32px;
  font-weight: 700;
}

.shelf__intro p {
  margin: 8px 0 0;
  color: #77847c;
  font-size: 16px;
}

.shelf__tabs {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.shelf__tab {
  border: 0;
  background: #fff;
  color: #34423b;
  border-radius: 19px;
  padding: 10px 20px;
  font: inherit;
  font-weight: 700;
  font-size: 14px;
  cursor: pointer;
}

.shelf__tab--active {
  background: #397653;
  color: #fff;
}

.shelf__panel {
  background: #fff;
  border-radius: 22px;
  padding: 24px;
  margin-top: 30px;
}

.shelf__panel h2 {
  margin: 0;
  color: #34423b;
  font-size: 22px;
  font-weight: 700;
}

.shelf__hint {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 14px;
}

.shelf__state {
  background: #fff;
  border-radius: 22px;
  padding: 32px;
  margin-top: 30px;
  color: #34423b;
}

.shelf__state h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.continue-list {
  list-style: none;
  padding: 0;
  margin: 22px 0 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.continue-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #d9f1e1;
  border-radius: 14px;
  padding: 12px 18px;
  max-width: 720px;
}

.continue-card__title {
  margin: 0;
  color: #34423b;
  font-weight: 700;
  font-size: 16px;
}

.continue-card__origin {
  margin: 4px 0 0;
  color: #77847c;
  font-size: 13px;
}

.continue-card__action {
  background: #397653;
  color: #fff;
  border-radius: 15px;
  padding: 13px 18px;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  white-space: nowrap;
}

.owned-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 24px;
  margin-top: 24px;
}

.owned-bundle {
  background: #e8e0fa;
  border-radius: 18px;
  padding: 18px;
}

.owned-bundle__eyebrow {
  margin: 0;
  color: #397653;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.owned-bundle h3,
.owned-book h3 {
  margin: 26px 0 0;
  color: #34423b;
  font-size: 22px;
  font-weight: 700;
}

.owned-book h3 {
  margin-top: 0;
  font-size: 16px;
}

.owned-bundle__meta,
.owned-book__meta {
  margin: 8px 0 0;
  color: #77847c;
  font-size: 13px;
}

.owned-bundle__note {
  margin: 28px 0 0;
  color: #34423b;
  font-size: 14px;
}

.owned-bundle__action,
.owned-book__action {
  display: inline-block;
  margin-top: 22px;
  border-radius: 15px;
  padding: 13px 18px;
  font-weight: 700;
  font-size: 15px;
  text-decoration: none;
  background: #397653;
  color: #fff;
}

.owned-book {
  background: #fff8ec;
  border-radius: 18px;
  padding: 18px;
}

.owned-book__action {
  background: #d9f1e1;
  color: #397653;
}

.owned-guidance {
  background: #d9f1e1;
  border-radius: 18px;
  padding: 22px;
}

.owned-guidance h3 {
  margin: 0;
  color: #397653;
  font-size: 18px;
  font-weight: 700;
}

.owned-guidance p {
  margin: 12px 0 0;
  color: #34423b;
  font-size: 14px;
}

@media (max-width: 720px) {
  .shelf {
    padding: 20px 16px 40px;
  }

  .continue-card {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
