<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import { ApiError } from '../api/client'
import { getBundle, listTags, type BundleDetailResponse, type Card } from '../api/catalog'
import { createOrder } from '../api/orders'
import { useSession } from '../composables/useSession'
import { useToast } from '../composables/useToast'

const route = useRoute()
const session = useSession()
const { message: toast, show: showToast } = useToast()

const detail = ref<BundleDetailResponse | null>(null)
const tagNames = ref<Map<string, string>>(new Map())
const loading = ref(true)
const notFound = ref(false)
const loadError = ref('')

const buying = ref(false)
const confirming = ref(false)
const buyError = ref('')

// Only the newest request may write state: switching bundle quickly must not mix them.
let requestId = 0

const load = async () => {
  const current = ++requestId
  const slug = String(route.params.slug)

  loading.value = true
  notFound.value = false
  loadError.value = ''
  detail.value = null

  try {
    const [bundle, tags] = await Promise.all([getBundle(slug), listTags().catch(() => [])])
    if (current !== requestId) return

    detail.value = bundle
    tagNames.value = new Map(tags.map((tag) => [tag.slug, tag.name]))
  } catch (err) {
    if (current !== requestId) return
    if (err instanceof ApiError && err.status === 404) notFound.value = true
    else loadError.value = 'Không tải được gói sách. Kiểm tra kết nối rồi thử lại.'
  } finally {
    if (current === requestId) loading.value = false
  }
}

onMounted(load)
watch(() => route.params.slug, load)

const bundle = computed<Card | null>(() => detail.value?.bundle ?? null)
const books = computed<Card[]>(() => detail.value?.books ?? [])

const money = (value: number | null) =>
  value === null ? '' : `${value.toLocaleString('vi-VN')}đ`

// A bundle has no ages of its own: show the span covered by the books it contains.
const ageRange = computed(() => {
  const ranges = books.value
    .filter((book) => book.age_min !== null && book.age_max !== null)
    .map((book) => [book.age_min as number, book.age_max as number])
  if (!ranges.length) return ''

  const min = Math.min(...ranges.map(([low]) => low))
  const max = Math.max(...ranges.map(([, high]) => high))
  return `${min}–${max} tuổi`
})

const topicNames = computed(() => {
  const seen = new Set<string>()
  return (bundle.value?.tag_slugs ?? [])
    .map((slug) => tagNames.value.get(slug) ?? '')
    .filter((name) => name && !seen.has(name) && seen.add(name))
})

const metaLine = computed(() =>
  [bundle.value ? `${books.value.length} sách trả phí` : '', ...topicNames.value, ageRange.value]
    .filter(Boolean)
    .join(' · '),
)

const isParent = computed(() => session.user.value?.role === 'parent')
const isTeacher = computed(() => session.user.value?.role === 'teacher')

const buyLabel = computed(() =>
  session.user.value
    ? isParent.value
      ? 'Mua gói sách'
      : 'Chỉ phụ huynh mua được'
    : 'Đăng nhập để mua',
)

const requestBuy = () => {
  if (!bundle.value || buying.value || !isParent.value) return
  confirming.value = true
}

const buy = async () => {
  confirming.value = false
  if (!bundle.value || buying.value) return

  buying.value = true
  buyError.value = ''
  try {
    const order = await createOrder({ bundleSlug: bundle.value.slug })
    if (order.payment_url) {
      showToast('Đang chuyển sang cổng thanh toán VNPay…')
      window.location.assign(order.payment_url)
      return
    }
    showToast('Đã tạo đơn. Cổng thanh toán chưa trả về liên kết.')
  } catch (err) {
    buyError.value = buyMessage(err)
  } finally {
    buying.value = false
  }
}

const buyMessage = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Không tạo được đơn. Vui lòng thử lại.'

  switch (err.code) {
    case 'not_purchasable':
      return 'Gói này chưa mở bán, hoặc bạn đã sở hữu nó.'
    case 'not_found':
      return 'Không tìm thấy gói sách này.'
    case 'validation':
      return 'Cần đăng nhập bằng tài khoản phụ huynh để mua.'
    case 'vnpay_unavailable':
    case 'payment_unavailable':
      return 'Cổng thanh toán VNPay chưa được cấu hình. Vui lòng thử lại sau.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không tạo được đơn. Vui lòng thử lại.'
  }
}
</script>

<template>
  <div class="bundle">
    <AppHeader />

    <main class="bundle__shell">
      <nav class="bundle__crumb" aria-label="Đường dẫn">
        <RouterLink to="/library">← Thư viện</RouterLink>
        <span aria-hidden="true">/</span>
        <span>Gói sách</span>
      </nav>

      <p v-if="loading" class="bundle__state" role="status">Đang tải gói sách…</p>

      <div v-else-if="notFound" class="bundle__state">
        <h1>Không tìm thấy gói sách này</h1>
        <p>Gói có thể đã được ẩn hoặc đường dẫn không đúng.</p>
        <RouterLink class="bundle__cta" to="/library">Về thư viện</RouterLink>
      </div>

      <div v-else-if="loadError" class="bundle__state" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="bundle__cta" @click="load">Thử lại</button>
      </div>

      <template v-else-if="bundle">
        <section class="bundle__hero">
          <img
            v-if="bundle.cover_url"
            class="bundle__cover"
            :src="bundle.cover_url"
            :alt="`Bìa gói ${bundle.title}`"
          />
          <div v-else class="bundle__cover bundle__cover--empty" aria-hidden="true">📚</div>

          <div class="bundle__intro">
            <p class="bundle__eyebrow">GÓI SÁCH</p>
            <h1>{{ bundle.title }}</h1>
            <p v-if="metaLine" class="bundle__meta">{{ metaLine }}</p>
            <p v-if="detail?.description" class="bundle__desc">{{ detail.description }}</p>

            <p class="bundle__price">{{ money(bundle.price_vnd) }}</p>
            <p class="bundle__note">
              Mua một lần · Mở ngay toàn bộ {{ books.length }} sách
            </p>

            <RouterLink
              v-if="!session.user.value"
              class="bundle__cta"
              :to="`/login?redirect=${encodeURIComponent(`/bundles/${bundle.slug}`)}`"
            >
              {{ buyLabel }}
            </RouterLink>
            <button
              v-else
              type="button"
              class="bundle__cta"
              :disabled="!isParent || buying"
              @click="requestBuy"
            >
              {{ buying ? 'Đang tạo đơn…' : buyLabel }}
            </button>

            <p v-if="buyError" class="bundle__error" role="alert">{{ buyError }}</p>
          </div>
        </section>

        <div class="bundle__grid">
          <section class="bundle__card">
            <h2>Sách trong gói</h2>
            <p class="bundle__card-sub">
              Các sách đều là nội dung trả phí do cùng giáo viên tạo.
            </p>

            <ul class="bundle__books">
              <li v-for="book in books" :key="book.id" class="bundle__book">
                <img
                  v-if="book.cover_url"
                  class="bundle__book-cover"
                  :src="book.cover_url"
                  :alt="`Bìa ${book.title}`"
                />
                <div class="bundle__book-main">
                  <RouterLink class="bundle__book-title" :to="`/books/${book.slug}`">
                    {{ book.title }}
                  </RouterLink>
                  <p class="bundle__book-meta">
                    {{
                      [
                        book.tag_slugs.map((slug) => tagNames.get(slug) ?? '').filter(Boolean).join(', '),
                        book.age_min !== null && book.age_max !== null
                          ? `${book.age_min}–${book.age_max} tuổi`
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ')
                    }}
                  </p>
                </div>
                <span class="bundle__book-chip">Có trong gói</span>
              </li>
            </ul>

            <p v-if="!books.length" class="bundle__card-sub">
              Gói này chưa có sách nào hiển thị.
            </p>
          </section>

          <aside class="bundle__side">
            <section class="bundle__card bundle__card--mint">
              <h2>Mua gói, đọc trọn bộ</h2>
              <p>Sau khi thanh toán, tất cả sách trong gói sẽ xuất hiện trong Tủ sách của phụ huynh.</p>
              <p class="bundle__side-note">Gói này chỉ gồm sách trả phí.</p>
            </section>

            <section v-if="!isTeacher" class="bundle__card">
              <h2>Từ giáo viên</h2>
              <p class="bundle__card-sub">
                Nội dung và giá của gói do giáo viên tạo và quản lý.
              </p>
            </section>
          </aside>
        </div>
      </template>
    </main>

    <AppFooter :label="bundle ? bundle.title : 'Gói sách'" />

    <ConfirmDialog
      :open="confirming"
      title="Mua gói sách này?"
      :message="`Bạn sẽ thanh toán ${money(bundle?.price_vnd ?? null)} cho “${bundle?.title ?? ''}” qua VNPay.`"
      confirm-label="Sang VNPay"
      @confirm="buy"
      @cancel="confirming = false"
    />
    <AppToast :message="toast" />
  </div>
</template>

<style scoped>
.bundle {
  min-height: 100vh;
  background: #fffaf2;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.bundle__shell {
  max-width: 1360px;
  margin: 0 auto;
  padding: 24px 40px 56px;
}

.bundle__crumb {
  display: flex;
  gap: 8px;
  align-items: center;
  color: #77847c;
  font-size: 14px;
  margin-bottom: 16px;
}

.bundle__crumb a {
  color: #397653;
  font-weight: 700;
  text-decoration: none;
}

.bundle__hero {
  display: grid;
  grid-template-columns: 360px minmax(0, 1fr);
  gap: 32px;
  align-items: start;
  background: #fff;
  border-radius: 24px;
  padding: 32px;
}

@media (max-width: 900px) {
  .bundle__hero {
    grid-template-columns: minmax(0, 1fr);
  }
}

.bundle__cover {
  width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 20px;
  background: #e8e0fa;
}

.bundle__cover--empty {
  display: grid;
  place-items: center;
  font-size: 56px;
}

.bundle__eyebrow {
  margin: 0;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.08em;
}

.bundle__intro h1 {
  margin: 8px 0 0;
  font-size: 36px;
  line-height: 1.15;
}

.bundle__meta {
  margin: 10px 0 0;
  color: #77847c;
  font-size: 15px;
}

.bundle__desc {
  margin: 14px 0 0;
  font-size: 16px;
  line-height: 1.55;
  max-width: 640px;
}

.bundle__price {
  margin: 20px 0 0;
  color: #397653;
  font-size: 30px;
  font-weight: 700;
}

.bundle__note {
  margin: 4px 0 0;
  color: #77847c;
  font-size: 14px;
}

.bundle__cta {
  display: inline-block;
  margin-top: 20px;
  border: 0;
  background: #397653;
  color: #fff;
  border-radius: 15px;
  padding: 14px 28px;
  font: inherit;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  text-decoration: none;
}

.bundle__cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.bundle__error {
  margin: 12px 0 0;
  color: #b3261e;
  font-size: 14px;
  font-weight: 700;
}

.bundle__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(0, 1fr);
  gap: 24px;
  margin-top: 24px;
}

@media (max-width: 900px) {
  .bundle__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.bundle__card {
  background: #fff;
  border-radius: 22px;
  padding: 26px 28px;
}

.bundle__card h2 {
  margin: 0;
  font-size: 22px;
}

.bundle__card-sub {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 14px;
}

.bundle__card--mint {
  background: #d9f1e1;
}

.bundle__card--mint p {
  margin: 10px 0 0;
  font-size: 15px;
  line-height: 1.55;
}

.bundle__side {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.bundle__side-note {
  font-weight: 700;
}

.bundle__books {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bundle__book {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #fff8ec;
  border-radius: 16px;
  padding: 12px 16px;
}

.bundle__book-cover {
  width: 44px;
  height: 56px;
  object-fit: cover;
  border-radius: 8px;
  flex: none;
}

.bundle__book-main {
  flex: 1;
  min-width: 0;
}

.bundle__book-title {
  color: #34423b;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
}

.bundle__book-meta {
  margin: 2px 0 0;
  color: #77847c;
  font-size: 13px;
}

.bundle__book-chip {
  color: #397653;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.bundle__state {
  background: #fff;
  border-radius: 22px;
  padding: 28px;
}

.bundle__state h1 {
  margin: 0 0 8px;
  font-size: 26px;
}

.bundle__state p {
  margin: 0 0 14px;
  color: #77847c;
}
</style>
