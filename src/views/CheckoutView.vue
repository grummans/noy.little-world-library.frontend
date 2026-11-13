<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink, useRoute } from 'vue-router'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import ResultDialog from '../components/app/ResultDialog.vue'
import { ApiError } from '../api/client'
import { getBook, getBundle } from '../api/catalog'
import { createOrder } from '../api/orders'
import { useToast } from '../composables/useToast'

const route = useRoute()
const { message: toast, show: showToast } = useToast()

const kind = computed(() => (route.query.bundle ? 'bundle' : 'book'))
const slug = computed(() => String(route.query.bundle ?? route.query.book ?? ''))

const title = ref('')
const description = ref('')
const cover = ref('')
const price = ref<number | null>(null)
const loading = ref(true)
const loadError = ref('')

const confirming = ref(false)
const paying = ref(false)
// A failed confirm answers with a dialog. Success leaves the page for VNPay, so there is
// nothing to acknowledge here: the payment page itself is the next screen.
const payError = ref<{ title: string; message?: string } | null>(null)

onMounted(async () => {
  if (!slug.value) {
    loading.value = false
    loadError.value = 'Không có sản phẩm nào được chọn để thanh toán.'
    return
  }

  try {
    if (kind.value === 'bundle') {
      const detail = await getBundle(slug.value)
      title.value = detail.bundle.title
      description.value = detail.description
      cover.value = detail.bundle.cover_url
      price.value = detail.bundle.price_vnd
      requirePaidProduct(detail.bundle.access_type, detail.bundle.price_vnd)
    } else {
      const detail = await getBook(slug.value)
      title.value = detail.book.title
      description.value = detail.description
      cover.value = detail.book.cover_url
      price.value = detail.book.price_vnd
      requirePaidProduct(detail.book.access_type, detail.book.price_vnd)
    }
  } catch (err) {
    loadError.value =
      err instanceof ApiError && err.status === 404
        ? 'Sản phẩm này không còn bán.'
        : 'Không tải được sản phẩm. Kiểm tra kết nối rồi thử lại.'
  } finally {
    loading.value = false
  }
})

// A free book, or a product with no price, must never reach the payment step.
const requirePaidProduct = (accessType: string, value: number | null) => {
  if (accessType !== 'paid' || value === null || value <= 0) {
    loadError.value = 'Sản phẩm này không cần thanh toán hoặc chưa mở bán.'
    title.value = ''
  }
}

const money = (value: number | null) =>
  value === null ? '' : `${value.toLocaleString('vi-VN')}đ`

const requestPay = () => {
  if (paying.value || loading.value || loadError.value || !price.value) return
  confirming.value = true
}

const pay = async () => {
  confirming.value = false
  if (paying.value) return

  paying.value = true
  payError.value = null
  try {
    const order = await createOrder(
      kind.value === 'bundle' ? { bundleSlug: slug.value } : { bookSlug: slug.value },
    )

    if (!order.payment_url) {
      payError.value = { title: 'Chưa tạo được đơn', message: 'Chưa nhận được liên kết thanh toán. Vui lòng thử lại.' }
      return
    }

    showToast('Đang chuyển sang cổng thanh toán VNPay…')
    window.location.assign(order.payment_url)
  } catch (err) {
    payError.value = { title: 'Chưa tạo được đơn thanh toán', message: payMessage(err) }
  } finally {
    paying.value = false
  }
}

const payMessage = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Không tạo được đơn. Vui lòng thử lại.'

  if (err.status === 401 || err.status === 403) {
    return 'Phiên đăng nhập đã hết hạn hoặc tài khoản này không mua được. Hãy đăng nhập lại bằng tài khoản phụ huynh.'
  }

  switch (err.code) {
    case 'not_purchasable':
      return 'Bạn đã sở hữu sản phẩm này, hoặc sản phẩm chưa mở bán.'
    case 'not_found':
      return 'Không tìm thấy sản phẩm này.'
    case 'validation':
      return 'Đơn hàng đã thay đổi (giá hoặc nội dung). Vui lòng tải lại trang rồi thử lại.'
    case 'payment_unavailable':
    case 'vnpay_unavailable':
      return 'Cổng thanh toán VNPay chưa được cấu hình. Vui lòng thử lại sau.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không tạo được đơn. Vui lòng thử lại.'
  }
}

const backTo = computed(() =>
  kind.value === 'bundle' ? `/bundles/${slug.value}` : `/books/${slug.value}`,
)
</script>

<template>
  <div class="checkout">
    <AppHeader />

    <main class="checkout__shell">
      <nav class="checkout__crumb" aria-label="Đường dẫn">
        <RouterLink :to="backTo">← Quay lại</RouterLink>
        <span aria-hidden="true">/</span>
        <span>Thanh toán</span>
      </nav>

      <p v-if="loading" class="checkout__state" role="status">Đang chuẩn bị đơn…</p>

      <div v-else-if="loadError" class="checkout__state" role="alert">
        <h1>Chưa thanh toán được</h1>
        <p>{{ loadError }}</p>
        <RouterLink class="checkout__cta" to="/library">Về thư viện</RouterLink>
      </div>

      <div v-else class="checkout__grid">
        <section class="checkout__card">
          <h1>Xác nhận đơn</h1>
          <p class="checkout__sub">
            Kiểm tra sản phẩm và số tiền trước khi sang cổng thanh toán VNPay.
          </p>

          <div class="checkout__item">
            <img v-if="cover" class="checkout__cover" :src="cover" :alt="`Bìa ${title}`" />
            <div v-else class="checkout__cover checkout__cover--empty" aria-hidden="true">📚</div>
            <div>
              <p class="checkout__kind">{{ kind === 'bundle' ? 'Gói sách' : 'Sách lẻ' }}</p>
              <p class="checkout__title">{{ title }}</p>
              <p v-if="description" class="checkout__desc">{{ description }}</p>
            </div>
          </div>

          <dl class="checkout__rows">
            <div>
              <dt>Tiền hàng</dt>
              <dd>{{ money(price) }}</dd>
            </div>
            <div>
              <dt>Phương thức</dt>
              <dd>VNPay (ATM / Visa / QR)</dd>
            </div>
            <div class="checkout__total">
              <dt>Tổng thanh toán</dt>
              <dd>{{ money(price) }}</dd>
            </div>
          </dl>



          <button
            v-if="!loadError"
            type="button"
            class="checkout__cta"
            :disabled="paying || !price"
            @click="requestPay"
          >
            {{ paying ? 'Đang tạo đơn…' : 'Thanh toán qua VNPay' }}
          </button>

          <p class="checkout__note">
            Sau khi thanh toán thành công, nội dung sẽ xuất hiện trong Tủ sách của phụ huynh.
          </p>
        </section>

        <aside class="checkout__card checkout__card--mint">
          <h2>Lưu ý</h2>
          <ul class="checkout__list">
            <li>Đơn chỉ được ghi nhận là đã thanh toán khi VNPay xác nhận.</li>
            <li>Đóng trình duyệt giữa chừng thì đơn vẫn ở trạng thái chờ.</li>
            <li>Mỗi sản phẩm chỉ cần mua một lần.</li>
          </ul>
        </aside>
      </div>
    </main>

    <AppFooter label="Thanh toán" />

    <ConfirmDialog
      :open="confirming"
      title="Thanh toán đơn này?"
      :message="`Bạn sẽ trả ${money(price)} cho “${title}” qua VNPay.`"
      confirm-label="Sang VNPay"
      @confirm="pay"
      @cancel="confirming = false"
    />
    <!-- Not a result: it just bridges the redirect, so it stays a toast. -->
    <AppToast :message="toast" />
    <ResultDialog
      :open="Boolean(payError)"
      tone="error"
      :title="payError?.title ?? ''"
      :message="payError?.message"
      @close="payError = null"
    />
  </div>
</template>

<style scoped>
.checkout {
  min-height: 100vh;
  background: #fffaf2;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.checkout__shell {
  max-width: 1120px;
  margin: 0 auto;
  padding: 24px 32px 56px;
}

.checkout__crumb {
  display: flex;
  gap: 8px;
  color: #77847c;
  font-size: 14px;
  margin-bottom: 16px;
}

.checkout__crumb a {
  color: #397653;
  font-weight: 700;
  text-decoration: none;
}

.checkout__grid {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(0, 1fr);
  gap: 24px;
}

@media (max-width: 900px) {
  .checkout__grid {
    grid-template-columns: minmax(0, 1fr);
  }
}

.checkout__card {
  background: #fff;
  border-radius: 22px;
  padding: 28px;
}

.checkout__card--mint {
  background: #d9f1e1;
}

.checkout__card h1 {
  margin: 0;
  font-size: 28px;
}

.checkout__card h2 {
  margin: 0 0 10px;
  font-size: 20px;
}

.checkout__sub {
  margin: 6px 0 20px;
  color: #77847c;
  font-size: 14px;
}

.checkout__item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 16px;
  background: #fff8ec;
  border-radius: 18px;
}

.checkout__cover {
  width: 76px;
  height: 96px;
  object-fit: cover;
  border-radius: 12px;
  flex: none;
  background: #e8e0fa;
}

.checkout__cover--empty {
  display: grid;
  place-items: center;
  font-size: 30px;
}

.checkout__kind {
  margin: 0;
  color: #397653;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.checkout__title {
  margin: 4px 0 0;
  font-size: 18px;
  font-weight: 700;
}

.checkout__desc {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 14px;
}

.checkout__rows {
  margin: 20px 0 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.checkout__rows > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 15px;
}

.checkout__rows dt {
  color: #77847c;
}

.checkout__rows dd {
  margin: 0;
  font-weight: 700;
}

.checkout__total {
  border-top: 1px dashed #dee8db;
  padding-top: 12px;
  font-size: 17px;
}

.checkout__total dd {
  color: #397653;
}

.checkout__cta {
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

.checkout__cta:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.checkout__error {
  margin: 16px 0 0;
  color: #b3261e;
  font-size: 14px;
  font-weight: 700;
}

.checkout__note {
  margin: 12px 0 0;
  color: #77847c;
  font-size: 13px;
}

.checkout__list {
  margin: 0;
  padding-left: 20px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 14px;
  line-height: 1.5;
}

.checkout__state {
  background: #fff;
  border-radius: 22px;
  padding: 28px;
}

.checkout__state h1 {
  margin: 0 0 8px;
  font-size: 26px;
}

.checkout__state p {
  margin: 0 0 14px;
  color: #77847c;
}
</style>
