<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import { apiFetch, ApiError } from '../api/client'

// The server verifies the VNPay signature; this page only renders its verdict.
interface ReturnState {
  status: 'paid' | 'failed' | 'cancelled' | 'verifying' | 'invalid'
  code: string
  message: string
  txn_ref: string
}

const state = ref<ReturnState | null>(null)
const loading = ref(true)
const error = ref('')
let pollTimer: ReturnType<typeof setTimeout> | undefined
// IPN can land a moment after the browser returns: keep asking for a short while.
const MAX_POLLS = 6
let polls = 0

const load = async () => {
  try {
    const query = window.location.search
    const result = await apiFetch<ReturnState>(`/api/payments/vnpay/return${query}`)
    state.value = result

    if (result.status === 'verifying' && polls < MAX_POLLS) {
      polls += 1
      pollTimer = setTimeout(load, 2000)
      return
    }

    if (result.status === 'verifying') {
      state.value = {
        ...result,
        message: 'Chưa nhận được xác nhận từ VNPay. Đơn vẫn ở trạng thái chờ, bạn có thể kiểm tra lại trong Tủ sách.',
      }
    }
  } catch (err) {
    error.value =
      err instanceof ApiError && err.status === 404
        ? 'Không tìm thấy đơn hàng này.'
        : 'Không kiểm tra được kết quả thanh toán. Kiểm tra kết nối rồi thử lại.'
  } finally {
    loading.value = false
  }
}

onMounted(load)
onBeforeUnmount(() => pollTimer && clearTimeout(pollTimer))

const view = computed(() => {
  switch (state.value?.status) {
    case 'paid':
      return { icon: '🎉', title: 'Thanh toán thành công!', tone: 'ok' as const }
    case 'cancelled':
      return { icon: '🚫', title: 'Bạn đã huỷ thanh toán', tone: 'warn' as const }
    case 'failed':
      return { icon: '⚠️', title: 'Thanh toán chưa thành công', tone: 'warn' as const }
    case 'verifying':
      return { icon: '⏳', title: 'Đang xác nhận thanh toán', tone: 'warn' as const }
    default:
      return { icon: '❔', title: 'Không xác thực được giao dịch', tone: 'warn' as const }
  }
})
</script>

<template>
  <div class="pay">
    <AppHeader />

    <main class="pay__shell">
      <p v-if="loading" class="pay__card" role="status">Đang kiểm tra kết quả thanh toán…</p>

      <div v-else-if="error" class="pay__card" role="alert">
        <h1>Chưa đọc được kết quả</h1>
        <p>{{ error }}</p>
        <RouterLink class="pay__cta" to="/library">Về thư viện</RouterLink>
      </div>

      <div v-else class="pay__card" :class="`pay__card--${view.tone}`">
        <p class="pay__icon" aria-hidden="true">{{ view.icon }}</p>
        <h1>{{ view.title }}</h1>
        <p class="pay__message">{{ state?.message }}</p>

        <dl v-if="state?.txn_ref" class="pay__rows">
          <div>
            <dt>Mã đơn</dt>
            <dd>{{ state.txn_ref }}</dd>
          </div>
          <div v-if="state?.code">
            <dt>Mã phản hồi VNPay</dt>
            <dd>{{ state.code }}</dd>
          </div>
        </dl>

        <div class="pay__actions">
          <RouterLink v-if="state?.status === 'paid'" class="pay__cta" to="/parent/library">
            Vào Tủ sách của bé
          </RouterLink>
          <RouterLink v-else-if="state?.status !== 'invalid'" class="pay__cta" to="/library">
            Thử thanh toán lại
          </RouterLink>
          <RouterLink v-else class="pay__cta" to="/library">Về thư viện</RouterLink>
          <RouterLink class="pay__link" to="/library">Tiếp tục xem sách</RouterLink>
        </div>
      </div>
    </main>

    <AppFooter label="Kết quả thanh toán" />
  </div>
</template>

<style scoped>
.pay {
  min-height: 100vh;
  background: #fffaf2;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.pay__shell {
  max-width: 720px;
  margin: 0 auto;
  padding: 40px 24px 64px;
}

.pay__card {
  background: #fff;
  border-radius: 24px;
  padding: 36px 32px;
  text-align: center;
}

.pay__card--ok {
  background: #d9f1e1;
}

.pay__icon {
  margin: 0;
  font-size: 48px;
  line-height: 1;
}

.pay__card h1 {
  margin: 14px 0 0;
  font-size: 28px;
}

.pay__message {
  margin: 10px auto 0;
  max-width: 46ch;
  color: #5b6b62;
  font-size: 15px;
  line-height: 1.55;
}

.pay__rows {
  margin: 22px auto 0;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-align: left;
}

.pay__rows > div {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  font-size: 14px;
}

.pay__rows dt {
  color: #77847c;
}

.pay__rows dd {
  margin: 0;
  font-weight: 700;
  word-break: break-all;
}

.pay__actions {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.pay__cta {
  display: inline-block;
  border: 0;
  background: #397653;
  color: #fff;
  border-radius: 15px;
  padding: 13px 26px;
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  text-decoration: none;
}

.pay__link {
  color: #397653;
  font-size: 14px;
  font-weight: 700;
}
</style>
