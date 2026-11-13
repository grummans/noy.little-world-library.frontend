<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import { ApiError } from '../api/client'
import { listMyOrders, type OrderListItem } from '../api/orders'

const orders = ref<OrderListItem[]>([])
const loading = ref(true)
const error = ref('')

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    orders.value = await listMyOrders()
  } catch (err) {
    error.value =
      err instanceof ApiError && (err.status === 401 || err.status === 403)
        ? 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
        : 'Không tải được danh sách đơn. Kiểm tra kết nối rồi thử lại.'
  } finally {
    loading.value = false
  }
}

onMounted(load)

const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`

const statusView = (status: OrderListItem['status']) => {
  switch (status) {
    case 'paid':
      return { label: 'Đã thanh toán', tone: 'ok' as const }
    case 'pending':
      return { label: 'Chờ thanh toán', tone: 'wait' as const }
    case 'cancelled':
      return { label: 'Đã huỷ', tone: 'muted' as const }
    default:
      return { label: 'Thất bại', tone: 'bad' as const }
  }
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

const paidCount = computed(() => orders.value.filter((o) => o.status === 'paid').length)
</script>

<template>
  <div class="orders">
    <AppHeader />

    <main class="orders__shell">
      <header class="orders__head">
        <h1>Đơn hàng của tôi</h1>
        <p>Mỗi giao dịch chỉ được ghi nhận khi VNPay xác nhận. Đơn chờ có thể thanh toán lại.</p>
      </header>

      <p v-if="loading" class="orders__state" role="status">Đang tải đơn hàng…</p>

      <p v-else-if="error" class="orders__state orders__state--error" role="alert">
        {{ error }}
        <button type="button" class="orders__link" @click="load">Thử lại</button>
      </p>

      <div v-else-if="!orders.length" class="orders__state">
        <h2>Chưa có đơn nào</h2>
        <p>Các gói sách và sách trả phí bạn mua sẽ hiện ở đây.</p>
        <RouterLink class="orders__cta" to="/library">Xem thư viện</RouterLink>
      </div>

      <template v-else>
        <p class="orders__count">{{ paidCount }} đơn đã thanh toán · {{ orders.length }} đơn tổng cộng</p>

        <ul class="orders__list">
          <li v-for="order in orders" :key="order.id" class="orders__item">
            <div class="orders__main">
              <p class="orders__title">{{ order.item_title || 'Đơn hàng' }}</p>
              <p class="orders__meta">
                {{ when(order.created_at) }} · {{ order.txn_ref }}
                <span v-if="order.transaction_no"> · VNPay {{ order.transaction_no }}</span>
              </p>
            </div>

            <span class="orders__chip" :class="`orders__chip--${statusView(order.status).tone}`">
              {{ statusView(order.status).label }}
            </span>

            <p class="orders__amount">{{ money(order.amount_vnd) }}</p>

            <div class="orders__actions">
              <RouterLink
                v-if="order.status === 'paid'"
                class="orders__link"
                to="/parent/library"
              >
                Vào tủ sách
              </RouterLink>
              <RouterLink
                v-else-if="order.status === 'pending'"
                class="orders__link"
                :to="`/checkout?${order.bundle_id ? 'bundle' : 'book'}=${order.item_slug}`"
              >
                Thanh toán lại
              </RouterLink>
              <span v-else class="orders__note">Không trừ tiền</span>
            </div>
          </li>
        </ul>
      </template>
    </main>

    <AppFooter label="Đơn hàng" />
  </div>
</template>

<style scoped>
.orders {
  min-height: 100vh;
  background: #fffaf2;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.orders__shell {
  max-width: 960px;
  margin: 0 auto;
  padding: 32px 24px 56px;
}

.orders__head h1 {
  margin: 0;
  font-size: 30px;
}

.orders__head p {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 15px;
}

.orders__count {
  margin: 20px 0 10px;
  color: #77847c;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.orders__list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.orders__item {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  gap: 14px;
  align-items: center;
  background: #fff;
  border-radius: 18px;
  padding: 16px 18px;
}

@media (max-width: 760px) {
  .orders__item {
    grid-template-columns: minmax(0, 1fr) auto;
    row-gap: 8px;
  }
}

.orders__title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
}

.orders__meta {
  margin: 3px 0 0;
  color: #77847c;
  font-size: 12px;
  word-break: break-all;
}

.orders__amount {
  margin: 0;
  font-weight: 700;
  white-space: nowrap;
}

.orders__chip {
  border-radius: 999px;
  padding: 5px 12px 3px;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.orders__chip--ok {
  background: #d9f1e1;
  color: #397653;
}

.orders__chip--wait {
  background: #ffe8b0;
  color: #6b4b12;
}

.orders__chip--muted {
  background: #eef1ef;
  color: #5b6b62;
}

.orders__chip--bad {
  background: #fbe0dd;
  color: #b3261e;
}

.orders__actions {
  justify-self: end;
}

.orders__link {
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

.orders__note {
  color: #77847c;
  font-size: 13px;
}

.orders__state {
  background: #fff;
  border-radius: 18px;
  padding: 24px;
}

.orders__state h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.orders__state p {
  margin: 0 0 14px;
  color: #77847c;
}

.orders__state--error {
  color: #b3261e;
}

.orders__cta {
  display: inline-block;
  background: #397653;
  color: #fff;
  border-radius: 15px;
  padding: 12px 20px;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}
</style>
