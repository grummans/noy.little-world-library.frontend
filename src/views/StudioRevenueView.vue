<script setup lang="ts">
// Revenue screen (`294:59`): the numbers come from paid orders only. There is no platform
// fee or payout in Phase 1, so net revenue is what buyers actually paid.
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import AppSelect from '../components/app/AppSelect.vue'
import StudioSidebar from '../components/studio/StudioSidebar.vue'
import { ApiError } from '../api/client'
import { getSales, type SalesRange, type SalesSummary } from '../api/teacher'

const summary = ref<SalesSummary | null>(null)
const loading = ref(true)
const error = ref('')
const range = ref<SalesRange>('30d')

const ranges: { value: SalesRange; label: string }[] = [
  { value: '30d', label: '30 ngày gần đây' },
  { value: '90d', label: '90 ngày gần đây' },
  { value: 'all', label: 'Tất cả thời gian' },
]

const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`
const day = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('vi-VN')
}
// Chart labels only need day and month: the year is the same for every bar.
const weekLabel = (iso: string) => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? iso
    : `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

const loadMessage = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Không tải được số liệu doanh thu.'
  if (err.status === 401 || err.status === 403) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  if (err.code === 'network') return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
  return 'Không tải được số liệu doanh thu.'
}

// Only the newest request may write the screen: a slow reply for 30d must not land on top of
// a faster one for 90d after the teacher already switched.
let loadSeq = 0

const load = async () => {
  const seq = ++loadSeq
  loading.value = true
  error.value = ''
  try {
    const data = await getSales(range.value)
    if (seq !== loadSeq) return
    summary.value = data
  } catch (err) {
    if (seq !== loadSeq) return
    error.value = loadMessage(err)
  } finally {
    if (seq === loadSeq) loading.value = false
  }
}

onMounted(load)
// Switching the period refetches: the totals, the chart and the book rows all follow it.
watch(range, load)

const totals = computed(() => summary.value?.totals ?? null)
const hasSales = computed(() => (totals.value?.orders ?? 0) > 0)

// Top products merge both forms of sale; a bundle's money never splits onto its books.
const topItems = computed(() => {
  const books = (summary.value?.books ?? []).map((item) => ({ ...item, kind: 'sách lẻ' }))
  const bundles = (summary.value?.bundles ?? []).map((item) => ({ ...item, kind: 'gói sách' }))
  return [...books, ...bundles]
    .filter((item) => item.sold > 0)
    .sort((a, b) => b.revenue_vnd - a.revenue_vnd)
    .slice(0, 4)
})

const share = computed(() => {
  const book = totals.value?.book_revenue_vnd ?? 0
  const bundle = totals.value?.bundle_revenue_vnd ?? 0
  const all = book + bundle
  if (all === 0) return { book: 0, bundle: 0, bookMoney: 0, bundleMoney: 0 }
  // The second half is whatever the first does not use, so the two never round to 101%.
  const bookPercent = Math.round((book / all) * 100)
  return {
    book: bookPercent,
    bundle: 100 - bookPercent,
    bookMoney: book,
    bundleMoney: bundle,
  }
})

const trend = computed(() => summary.value?.trend ?? [])
const trendMax = computed(() => Math.max(...trend.value.map((week) => week.revenue_vnd), 0))
// Every bar is relative to the best week, so a flat month still shows real heights; a week
// with no sale draws no bar at all.
const barHeight = (value: number) =>
  value === 0 || trendMax.value === 0 ? 0 : Math.max(2, (value / trendMax.value) * 100)
</script>

<template>
  <div class="studio">
    <AppHeader />

    <div class="studio__shell">
      <header class="studio__header">
        <nav class="studio__breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink to="/studio">Teacher Studio</RouterLink>
          <span aria-hidden="true">/</span>
          <span>Thống kê doanh thu</span>
        </nav>
        <p class="studio__eyebrow">
          <Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY
        </p>
        <div class="studio__header-row">
          <div>
            <h1 class="studio__title">Doanh thu của tôi</h1>
            <p class="studio__greeting">
              Theo dõi hiệu quả các cuốn sách và thu nhập từ thư viện của bạn.
            </p>
          </div>
          <AppSelect
            v-model="range"
            class="studio__period"
            label="Khoảng thời gian"
            :options="ranges"
          />
        </div>
      </header>

      <div class="studio__layout">
        <StudioSidebar />

        <main class="studio__main">
          <p class="studio__subtitle">Chỉ tính các đơn đã thanh toán thành công.</p>

          <p v-if="loading" class="studio__state" role="status">Đang tải số liệu…</p>

          <p v-else-if="error" class="studio__state studio__state--error" role="alert">
            {{ error }}
            <button type="button" class="studio__action" @click="load">Thử lại</button>
          </p>

          <template v-else-if="totals">
            <div class="studio__stats">
              <div class="studio__stat studio__stat--mint">
                <p class="studio__stat-value">{{ money(totals.revenue_vnd) }}</p>
                <p class="studio__stat-label">Doanh thu</p>
              </div>
              <div class="studio__stat studio__stat--sky">
                <p class="studio__stat-value">{{ totals.books_sold }}</p>
                <p class="studio__stat-label">Sách đã bán · lượt</p>
              </div>
              <div class="studio__stat studio__stat--lilac">
                <p class="studio__stat-value">{{ totals.bundles_sold }}</p>
                <p class="studio__stat-label">Gói sách đã bán · lượt</p>
              </div>
              <div class="studio__stat studio__stat--butter">
                <p class="studio__stat-value">{{ totals.orders }}</p>
                <p class="studio__stat-label">Đơn hàng thành công</p>
              </div>
            </div>

            <p v-if="!hasSales" class="studio__state" role="status">
              Chưa có đơn nào được thanh toán trong khoảng thời gian này.
            </p>

            <div class="studio__grid">
              <section class="studio__card studio__card--wide">
                <header class="studio__card-head">
                  <div>
                    <h2>Xu hướng doanh thu</h2>
                    <p>Doanh thu theo từng tuần</p>
                  </div>
                </header>
                <div class="chart">
                  <div
                    v-for="(week, index) in trend"
                    :key="week.week_start"
                    class="chart__column"
                    :title="`Tuần ${day(week.week_start)}: ${money(week.revenue_vnd)}`"
                  >
                    <div class="chart__track">
                      <div
                        class="chart__bar"
                        :class="{ 'chart__bar--current': index === trend.length - 1 }"
                        :style="{ height: `${barHeight(week.revenue_vnd)}%` }"
                      />
                    </div>
                    <span class="chart__label">{{ weekLabel(week.week_start) }}</span>
                  </div>
                </div>
                <!-- The bars are a picture of the same numbers, so screen readers get a list. -->
                <ul class="sr-only">
                  <li v-for="week in trend" :key="`sr-${week.week_start}`">
                    Tuần {{ day(week.week_start) }}: {{ money(week.revenue_vnd) }}
                  </li>
                </ul>
              </section>

              <section class="studio__card">
                <header class="studio__card-head">
                  <div>
                    <h2>Phân bố doanh thu</h2>
                    <p>Theo hình thức bán</p>
                  </div>
                </header>
                <div v-if="hasSales" class="split__bar" aria-hidden="true">
                  <span class="split__part split__part--book" :style="{ width: `${share.book}%` }" />
                  <span class="split__part split__part--bundle" :style="{ width: `${share.bundle}%` }" />
                </div>
                <ul class="split__list">
                  <li>
                    <span class="split__dot split__dot--book" aria-hidden="true" />
                    <span>Sách lẻ</span>
                    <strong>{{ share.book }}%</strong>
                    <span class="split__money">{{ money(share.bookMoney) }}</span>
                  </li>
                  <li>
                    <span class="split__dot split__dot--bundle" aria-hidden="true" />
                    <span>Gói sách</span>
                    <strong>{{ share.bundle }}%</strong>
                    <span class="split__money">{{ money(share.bundleMoney) }}</span>
                  </li>
                </ul>
              </section>
            </div>

            <div class="studio__grid studio__grid--even">
              <section class="studio__card">
                <header class="studio__card-head">
                  <div>
                    <h2>Sách mang về doanh thu cao</h2>
                    <p>Top 4 sản phẩm trong khoảng thời gian này</p>
                  </div>
                </header>
                <p v-if="!topItems.length" class="studio__state">Chưa có sản phẩm nào bán được.</p>
                <ol v-else class="top">
                  <li v-for="(item, index) in topItems" :key="`${item.kind}-${item.id}`">
                    <span class="top__rank">{{ String(index + 1).padStart(2, '0') }}</span>
                    <span class="top__body">
                      <span class="top__title">{{ item.title }}</span>
                      <span class="top__meta">{{ item.sold }} lượt · {{ item.kind }}</span>
                    </span>
                    <strong class="top__money">{{ money(item.revenue_vnd) }}</strong>
                  </li>
                </ol>
              </section>

              <section class="studio__card">
                <header class="studio__card-head">
                  <div>
                    <h2>Giao dịch gần đây</h2>
                    <p>Chỉ hiện đơn đã ghi nhận</p>
                  </div>
                </header>
                <p v-if="!summary?.recent.length" class="studio__state">Chưa có giao dịch nào.</p>
                <ul v-else class="recent">
                  <li v-for="(order, index) in summary.recent" :key="`${order.paid_at}-${index}`">
                    <span class="recent__date">{{ day(order.paid_at) }}</span>
                    <span class="recent__title">{{ order.title }}</span>
                    <strong class="recent__money">+{{ money(order.amount_vnd) }}</strong>
                  </li>
                </ul>
              </section>
            </div>

            <p class="studio__note">
              Doanh thu tính từ đơn đã thanh toán; gói sách được tính theo giá gói và không chia
              cho các sách bên trong.
            </p>
          </template>
        </main>
      </div>
    </div>
  </div>
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


/* The period picker sits on the title row, like the frame: one page title, no second one. */
.studio__header-row {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
  flex-wrap: wrap;
}
.studio__subtitle {
  margin: 0;
  color: #77847c;
  font-size: 15px;
}

/* The picker keeps its own metrics; AppSelect reads them from these variables. */
.studio__period {
  --select-border: #e4dccf;
  --select-padding: 10px 18px;
  --select-font-size: 14px;
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
  min-width: 170px;
  flex: 1 1 170px;
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

.studio__stat--lilac {
  background: #e6ddf9;
}

.studio__stat-value {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #2e4a38;
}

.studio__stat-label {
  margin: 6px 0 0;
  color: #5c6a62;
  font-size: 13px;
}

.studio__grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.studio__grid--even {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.studio__card {
  background: #fff;
  border-radius: 20px;
  padding: 20px;
}

.studio__card-head h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.studio__card-head p {
  margin: 4px 0 0;
  color: #77847c;
  font-size: 13px;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 18px;
  min-height: 190px;
  /* Twelve weeks do not fit a phone: the chart scrolls sideways instead of squeezing labels
     into each other. */
  overflow-x: auto;
  padding-bottom: 4px;
}

.chart__column {
  flex: 1 0 34px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.chart__track {
  width: 100%;
  height: 160px;
  display: flex;
  align-items: flex-end;
}

.chart__bar {
  width: 100%;
  border-radius: 10px 10px 6px 6px;
  background: #cdeada;
}

.chart__bar--current {
  background: #5aa87c;
}

.chart__label {
  color: #77847c;
  font-size: 11px;
}

.split__bar {
  display: flex;
  height: 16px;
  margin-top: 20px;
  border-radius: 999px;
  overflow: hidden;
  background: #f2ede4;
}

.split__part--book {
  background: #7cc4a0;
}

.split__part--bundle {
  background: #b9a6ea;
}

.split__list {
  list-style: none;
  margin: 18px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.split__list li {
  display: grid;
  grid-template-columns: 12px 1fr auto;
  align-items: center;
  gap: 10px;
  font-size: 14px;
}

.split__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.split__dot--book {
  background: #7cc4a0;
}

.split__dot--bundle {
  background: #b9a6ea;
}

.split__money {
  grid-column: 2 / -1;
  color: #77847c;
  font-size: 13px;
}

.top,
.recent {
  list-style: none;
  margin: 16px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
}

.top li {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  border-top: 1px solid #f2ede4;
}

.top li:first-child {
  border-top: 0;
}

.top__rank {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  border-radius: 12px;
  background: #f3f7f2;
  color: #397653;
  font-weight: 700;
}

.top__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.top__title {
  font-weight: 600;
  font-size: 15px;
}

.top__meta {
  color: #77847c;
  font-size: 13px;
}

.top__money {
  color: #2e4a38;
  font-size: 15px;
  white-space: nowrap;
}

.recent li {
  display: grid;
  grid-template-columns: 88px 1fr auto;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid #f2ede4;
  font-size: 14px;
  align-items: center;
}

.recent li:first-child {
  border-top: 0;
}

.recent__date {
  color: #77847c;
  font-size: 13px;
}

.recent__title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.recent__money {
  color: #397653;
  white-space: nowrap;
}

.studio__state {
  margin: 18px 0 0;
  color: #77847c;
  font-size: 14px;
}

.studio__state--error {
  color: #b3453a;
}

.studio__action {
  margin-left: 8px;
  border: 0;
  background: transparent;
  color: #397653;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
}

.studio__note {
  margin: 16px 0 0;
  padding: 14px 18px;
  border-radius: 16px;
  background: #e8f5ec;
  color: #4b6b56;
  font-size: 13px;
}

@media (max-width: 1024px) {
  .studio__layout {
    grid-template-columns: minmax(0, 1fr);
  }

  .studio__grid,
  .studio__grid--even {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 640px) {
  .studio__shell {
    padding: 16px;
  }

  .studio__title {
    font-size: 28px;
  }

  .chart {
    gap: 6px;
  }

  .recent li {
    grid-template-columns: 1fr auto;
  }

  .recent__date {
    grid-column: 1 / -1;
  }
}
</style>
