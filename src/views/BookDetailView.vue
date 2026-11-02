<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import {
  ArrowLeft,
  BookOpen,
  Heart,
  Lock,
  Palette,
  Play,
  Video,
  Volume2,
} from "lucide-vue-next";
import { RouterLink, useRoute } from "vue-router";
import AppHeader from "../components/app/AppHeader.vue";
import AppFooter from "../components/app/AppFooter.vue";
import BaseButton from "../components/ui/BaseButton.vue";
import { formatPrice, type Book } from "../data/books";
import { ApiError } from "../api/client";
import { getBook, listTags } from "../api/catalog";
import { cardToBook, tagNameLookup } from "../api/adapt";
import { categories } from "../data/categories";

const route = useRoute();
const savedBooks = ref<string[]>([]);
const storageKey = "little-wonder-saved-books";

const book = ref<Book | null>(null);
const loading = ref(true);
const notFound = ref(false);
const loadError = ref("");
// Only the newest request may write state: switching slug quickly must not let an older
// response overwrite the newer book.
let requestId = 0;

const load = async () => {
  const current = ++requestId;
  const slug = String(route.params.slug);

  loading.value = true;
  notFound.value = false;
  loadError.value = "";
  book.value = null;

  try {
    const [detail, tags] = await Promise.all([
      getBook(slug),
      listTags().catch(() => []),
    ]);
    if (current !== requestId) return;

    const mapped = cardToBook(detail.book, tagNameLookup(tags));
    mapped.description = detail.description;
    book.value = mapped;
  } catch (err) {
    if (current !== requestId) return;

    if (err instanceof ApiError && err.status === 404) {
      notFound.value = true;
    } else {
      loadError.value =
        err instanceof ApiError ? err.message : "Không tải được cuốn sách.";
    }
  } finally {
    if (current === requestId) loading.value = false;
  }
};

onMounted(load);
watch(() => route.params.slug, load);

const isSaved = computed(() =>
  Boolean(book.value && savedBooks.value.includes(book.value.slug)),
);
const categorySlug = computed(
  () =>
    categories.find((category) => category.name === book.value?.category)?.slug,
);
// Free books open straight away. Paid books need checkout, which does not exist yet, so
// the CTA must not pretend the book is readable.
const canReadNow = computed(() => book.value?.isFree === true);

const toggleSaved = () => {
  if (!book.value) return;

  const slug = book.value.slug;
  savedBooks.value = isSaved.value
    ? savedBooks.value.filter((savedSlug) => savedSlug !== slug)
    : [...savedBooks.value, slug];
};

onMounted(() => {
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    if (
      Array.isArray(stored) &&
      stored.every((item) => typeof item === "string")
    ) {
      savedBooks.value = stored;
    }
  } catch {
    savedBooks.value = [];
  }
});

watch(
  savedBooks,
  (value) => localStorage.setItem(storageKey, JSON.stringify(value)),
  { deep: true },
);
</script>
<template>
  <div class="detail-page">
    <AppHeader variant="overlay" contrast="dark" />

    <main v-if="book" class="detail-content">
      <nav class="breadcrumbs" aria-label="Đường dẫn">
        <RouterLink to="/library">Thư viện sách</RouterLink>
        <template v-if="book.category">
          <span aria-hidden="true">/</span>
          <RouterLink
            :to="categorySlug ? `/library?category=${categorySlug}` : '/library'"
          >
            {{ book.category }}
          </RouterLink>
        </template>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ book.title }}</span>
      </nav>

      <section class="detail-hero" :aria-labelledby="`book-${book.slug}`">
        <div class="detail-cover-wrap">
          <img
            class="detail-cover"
            :src="book.cover"
            :alt="`Bìa sách ${book.title}`"
          />
        </div>

        <div class="detail-copy">
          <p class="detail-format">SÁCH EPUB · BOOK CREATOR</p>
          <h1 :id="`book-${book.slug}`">{{ book.title }}</h1>
          <p class="detail-author">Thư viện Little Wonder</p>
          <p class="detail-description">{{ book.description }}</p>

          <ul class="detail-tags" aria-label="Thông tin sách">
            <li v-if="book.pageCount" class="detail-tag detail-tag--butter">
              {{ book.pageCount }} trang
            </li>
            <li v-if="book.ageRange" class="detail-tag detail-tag--butter">{{ book.ageRange }}</li>
            <li v-if="book.hasAudio" class="detail-tag detail-tag--sky">
              <Volume2 :size="15" /> Âm thanh
            </li>
            <li v-if="book.hasVideo" class="detail-tag detail-tag--sky">
              <Video :size="15" /> Video
            </li>
            <li class="detail-tag detail-tag--mint">
              <BookOpen :size="15" /> EPUB
            </li>
            <li
              class="detail-tag"
              :class="book.isFree ? 'detail-tag--mint' : 'detail-tag--butter'"
            >
              <Lock :size="15" /> {{ formatPrice(book) }}
            </li>
            <li class="detail-tag detail-tag--butter">
              <Palette :size="15" /> Minh họa
            </li>
          </ul>

          <div class="detail-actions">
            <BaseButton
              v-if="canReadNow"
              :to="`/read/${book.slug}`"
              class="detail-read"
            >
              <Play :size="18" fill="currentColor" /> Đọc sách ngay
            </BaseButton>
            <BaseButton
              v-else
              class="detail-read"
              :to="`/checkout?book=${book.slug}`"
            >
              <Lock :size="18" /> Mua sách · {{ formatPrice(book) }}
            </BaseButton>
            <button
              type="button"
              class="detail-save"
              :aria-pressed="isSaved"
              @click="toggleSaved"
            >
              <Heart :size="18" :fill="isSaved ? 'currentColor' : 'none'" />
              {{ isSaved ? "Đã lưu vào tủ sách" : "Lưu tủ sách" }}
            </button>
          </div>

          <p class="detail-note">
            Sách mẫu thực tế · Định dạng trang cố định · Hỗ trợ media tích hợp
          </p>
        </div>
      </section>

      <section class="detail-guidance" aria-labelledby="guidance-title">
        <h2 id="guidance-title">Gợi ý cùng con khám phá</h2>
        <p>
          Hãy trò chuyện cùng bé về những điều con đã thấy trong sách và khuyến
          khích bé kể lại theo cách của mình.
        </p>
        <ul v-if="book.learningObjectives.length">
          <li v-for="objective in book.learningObjectives" :key="objective">
            {{ objective }}
          </li>
        </ul>
        <p class="detail-guidance__note">
          Phụ huynh có thể quản lý quyền truy cập, sách đã mua và tiến độ đọc
          trong khu vực riêng.
        </p>
      </section>
    </main>

    <main v-else-if="loading" class="detail-missing" role="status">
      <h1>Đang tải cuốn sách…</h1>
    </main>

    <main v-else-if="loadError" class="detail-missing" role="alert">
      <h1>Chưa tải được cuốn sách</h1>
      <p>{{ loadError }}</p>
      <BaseButton variant="secondary" @click="load">Thử lại</BaseButton>
    </main>

    <main v-else-if="notFound" class="detail-missing">
      <h1>Không tìm thấy cuốn sách này</h1>
      <p>Cuốn sách có thể đã được di chuyển hoặc chưa được xuất bản.</p>
      <BaseButton to="/library" variant="secondary"
        ><ArrowLeft :size="18" /> Về thư viện</BaseButton
      >
    </main>

    <AppFooter :label="book ? book.title : 'Thư viện sách'" />

    <!-- Paid checkout lands here once the auth + payment screens exist (TODO 7). The
         old localStorage "unlock" pretended to buy a book the API then refused. -->
  </div>
</template>
