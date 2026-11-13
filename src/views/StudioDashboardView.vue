<script setup lang="ts">
// Teacher Studio dashboard (`378:7`): one screen that answers "what is going on in my
// library?" — books, games, money and the last transactions. Every number comes from the
// API; nothing on this page is illustrative.
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { BookOpen, Gamepad2, PencilLine, Sparkles, Wallet } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import StudioSidebar from '../components/studio/StudioSidebar.vue'
import UploadBookModal from '../components/studio/UploadBookModal.vue'
import { ApiError } from '../api/client'
import {
  getSales,
  listMyBooks,
  listMyBundles,
  type SalesSummary,
  type TeacherBook,
  type TeacherBundle,
} from '../api/teacher'
import { listMyActivities, type Activity, type ActivityStats } from '../api/activities'
import { useSession } from '../composables/useSession'

const session = useSession()

const books = ref<TeacherBook[]>([])
const bundles = ref<TeacherBundle[]>([])
const games = ref<Activity[]>([])
const gameStats = ref<ActivityStats>({ total: 0, published: 0, draft: 0, hidden: 0 })
const sales = ref<SalesSummary | null>(null)
const loading = ref(true)
const error = ref('')
// A failed side call must not read as "zero": the card that depends on it shows "—" and a
// failed reload drops the old numbers instead of leaving stale ones on screen.
const gamesFailed = ref(false)
const bundlesFailed = ref(false)
const salesFailed = ref(false)
const warning = ref('')
const uploadOpen = ref(false)

const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`

const loadMessage = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Không tải được số liệu tổng quan.'
  if (err.status === 401 || err.status === 403) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  }
  if (err.code === 'network') return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
  return 'Không tải được số liệu tổng quan.'
}

// Only the newest load may write the screen: the upload modal's @saved reload can overlap
// the first one, and a slow older reply must not land on top of it.
let loadSeq = 0

const load = async () => {
  const seq = ++loadSeq
  loading.value = true
  error.value = ''
  warning.value = ''

  const [bookResult, bundleResult, gameResult, salesResult] = await Promise.allSettled([
    listMyBooks(),
    listMyBundles(),
    listMyActivities(),
    getSales('30d'),
  ])
  if (seq !== loadSeq) return

  if (bookResult.status === 'fulfilled') {
    books.value = bookResult.value
  } else {
    error.value = loadMessage(bookResult.reason)
    books.value = []
  }

  // Each source is replaced by its own outcome: a failed reload must not keep the numbers
  // that the previous load put on screen.
  bundlesFailed.value = bundleResult.status === 'rejected'
  bundles.value = bundleResult.status === 'fulfilled' ? bundleResult.value : []

  gamesFailed.value = gameResult.status === 'rejected'
  games.value = gameResult.status === 'fulfilled' ? gameResult.value.items : []
  gameStats.value =
    gameResult.status === 'fulfilled'
      ? gameResult.value.stats
      : { total: 0, published: 0, draft: 0, hidden: 0 }

  salesFailed.value = salesResult.status === 'rejected'
  sales.value = salesResult.status === 'fulfilled' ? salesResult.value : null

  if (!error.value) {
    const missing: string[] = []
    if (bundlesFailed.value) missing.push('bộ sách')
    if (gamesFailed.value) missing.push('trò chơi')
    if (salesFailed.value) missing.push('doanh thu')
    if (missing.length) {
      warning.value = `Không tải được ${missing.join(', ')}; thẻ liên quan hiển thị “—”.`
    }
  }

  loading.value = false
}

onMounted(load)

const greetingName = computed(() => session.user.value?.display_name ?? '')

// ---- Books -------------------------------------------------------------------------

const publishedBooks = computed(() => books.value.filter((book) => book.status === 'published'))
const draftBooks = computed(() => books.value.filter((book) => book.status !== 'published'))
const draftsWithoutCover = computed(() => draftBooks.value.filter((book) => !book.has_cover))

// A month is the calendar month the studio is open in, not the last 30 days: the card says
// "trong tháng này".
const publishedThisMonth = computed(() => {
  const now = new Date()
  return publishedBooks.value.filter((book) => {
    if (!book.published_at) return false
    const date = new Date(book.published_at)
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()
  }).length
})

// ---- Games -------------------------------------------------------------------------

const publishedGames = computed(() => games.value.filter((game) => game.status === 'published'))

// The library's topic chips are the game topics; counting distinct ones is what the card
// promises, not the number of games that happen to have a topic.
const gameTopics = computed(
  () => new Set(publishedGames.value.map((game) => game.topic).filter(Boolean)).size,
)

const newestGame = computed(() => {
  const sorted = [...games.value].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  )
  return sorted[0] ?? null
})

const gameStatusLabel: Record<Activity['status'], string> = {
  published: 'Đã xuất bản',
  draft: 'Bản nháp',
  hidden: 'Đang ẩn',
}

// ---- Money -------------------------------------------------------------------------

const totals = computed(() => sales.value?.totals ?? null)

// The daily chart is a fixed seven-day window from the API; a day with no sale still gets
// a bar slot so the axis keeps seven labels.
const days = computed(() => sales.value?.days ?? [])
const daysMax = computed(() => Math.max(...days.value.map((day) => day.revenue_vnd), 0))
const barHeight = (value: number) =>
  value === 0 || daysMax.value === 0 ? 0 : Math.max(2, (value / daysMax.value) * 100)
const hasDailySales = computed(() => days.value.some((day) => day.revenue_vnd > 0))

const weekday = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? iso
    : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][date.getDay()]
}
const fullDay = (iso: string) => {
  const date = new Date(`${iso}T00:00:00`)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString('vi-VN')
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()

// "Hôm nay" / "Hôm qua" / "N ngày trước": the activity list is a glance, not a ledger.
const relativeDay = (iso: string) => {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86_400_000)
  if (diff <= 0) return 'Hôm nay'
  if (diff === 1) return 'Hôm qua'
  return `${diff} ngày trước`
}

const contentRows = computed(() => [
  { label: 'Sách đã xuất bản', value: publishedBooks.value.length, tone: 'mint' },
  { label: 'Sách nháp', value: draftBooks.value.length, tone: 'butter' },
  {
    label: 'Bộ sách',
    value: bundlesFailed.value ? '—' : bundles.value.length,
    tone: 'lilac',
  },
  {
    label: 'Trò chơi đã xuất bản',
    value: gamesFailed.value ? '—' : gameStats.value.published,
    tone: 'mint',
  },
])
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
          <span>Tổng quan</span>
        </nav>
        <p class="studio__eyebrow">
          <Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY
        </p>
        <div class="studio__header-row">
          <div>
            <h1 class="studio__title">Tổng quan không gian giáo viên</h1>
            <p class="studio__greeting">
              Xin chào{{ greetingName ? ` ${greetingName}` : '' }}! Đây là những điều đang diễn
              ra trong thư viện của bạn.
            </p>
          </div>
          <button type="button" class="studio__primary" @click="uploadOpen = true">
            ＋ Tải sách mới
          </button>
        </div>
      </header>

      <div class="studio__layout">
        <StudioSidebar />

        <main class="studio__main">
          <p v-if="loading" class="studio__state" role="status">Đang tải tổng quan…</p>

          <p v-else-if="error" class="studio__state studio__state--error" role="alert">
            {{ error }}
            <button type="button" class="studio__action" @click="load">Thử lại</button>
          </p>

          <template v-else>
            <p v-if="warning" class="studio__state studio__state--warning" role="status">
              {{ warning }}
            </p>

            <div class="dash__kpis">
              <section class="kpi">
                <span class="kpi__icon kpi__icon--mint" aria-hidden="true">
                  <BookOpen :size="19" />
                </span>
                <p class="kpi__label">Sách đã xuất bản</p>
                <p class="kpi__value">{{ publishedBooks.length }}</p>
                <p class="kpi__hint">
                  {{
                    publishedThisMonth
                      ? `+${publishedThisMonth} trong tháng này`
                      : 'Chưa có sách mới trong tháng'
                  }}
                </p>
              </section>

              <section class="kpi">
                <span class="kpi__icon kpi__icon--butter" aria-hidden="true">
                  <PencilLine :size="19" />
                </span>
                <p class="kpi__label">Bản nháp cần hoàn thiện</p>
                <p class="kpi__value">{{ draftBooks.length }}</p>
                <p class="kpi__hint">
                  {{
                    draftsWithoutCover.length
                      ? `${draftsWithoutCover.length} sách chưa có ảnh bìa`
                      : 'Bản nháp nào cũng đã có ảnh bìa'
                  }}
                </p>
              </section>

              <section class="kpi">
                <span class="kpi__icon kpi__icon--lilac" aria-hidden="true">
                  <Gamepad2 :size="19" />
                </span>
                <p class="kpi__label">Trò chơi đang hiển thị</p>
                <p class="kpi__value">{{ gamesFailed ? '—' : gameStats.published }}</p>
                <p class="kpi__hint">
                  {{
                    gamesFailed
                      ? 'Không tải được số liệu'
                      : gameTopics
                        ? `${gameTopics} chủ đề học tập`
                        : 'Chưa có chủ đề nào'
                  }}
                </p>
              </section>

              <section class="kpi">
                <span class="kpi__icon kpi__icon--peach" aria-hidden="true">
                  <Wallet :size="19" />
                </span>
                <p class="kpi__label">Doanh thu 30 ngày</p>
                <p class="kpi__value kpi__value--money">
                  {{ totals ? money(totals.revenue_vnd) : '—' }}
                </p>
                <p class="kpi__hint">
                  {{ totals ? `${totals.orders} đơn đã thanh toán` : 'Chưa tải được số liệu' }}
                </p>
              </section>
            </div>

            <div class="dash__grid">
              <section class="studio__card">
                <header class="studio__card-head">
                  <div>
                    <h2>Tổng quan trò chơi</h2>
                    <p>Quản lý hoạt động học tập tương tác của bạn</p>
                  </div>
                  <RouterLink class="studio__action" to="/studio/games">
                    Quản lý trò chơi →
                  </RouterLink>
                </header>

                <div class="game__tiles">
                  <div class="game__tile game__tile--mint">
                    <p class="game__value">{{ gamesFailed ? '—' : gameStats.total }}</p>
                    <p class="game__label">Tổng trò chơi</p>
                  </div>
                  <div class="game__tile game__tile--butter">
                    <p class="game__value">{{ gamesFailed ? '—' : gameStats.published }}</p>
                    <p class="game__label">Đã xuất bản</p>
                  </div>
                  <div class="game__tile game__tile--lilac">
                    <p class="game__value">{{ gamesFailed ? '—' : gameStats.draft }}</p>
                    <p class="game__label">Bản nháp</p>
                  </div>
                </div>

                <p class="game__newest-label">Trò chơi mới cập nhật</p>
                <p v-if="gamesFailed" class="game__empty">Không tải được số liệu trò chơi.</p>
                <p v-else-if="!newestGame" class="game__empty">Chưa có trò chơi nào.</p>
                <div v-else class="game__newest">
                  <span class="game__newest-icon" aria-hidden="true">
                    <Gamepad2 :size="17" />
                  </span>
                  <span class="game__newest-title">{{ newestGame.title }}</span>
                  <span class="game__newest-status">{{ gameStatusLabel[newestGame.status] }}</span>
                </div>
                <div class="divider" />
              </section>

              <section class="studio__card">
                <header class="studio__card-head">
                  <div>
                    <h2>Lối tắt công việc</h2>
                    <p>Bắt đầu nhanh từ những việc thường làm.</p>
                  </div>
                </header>

                <div class="shortcuts">
                  <button type="button" class="shortcut" @click="uploadOpen = true">
                    <span class="shortcut__icon shortcut__icon--mint" aria-hidden="true">＋</span>
                    <span class="shortcut__text">
                      <span class="shortcut__title">Tải lên sách EPUB</span>
                      <span class="shortcut__desc">Tạo sách mới từ tệp EPUB</span>
                    </span>
                    <span class="shortcut__arrow" aria-hidden="true">→</span>
                  </button>

                  <RouterLink class="shortcut" to="/studio/bundles">
                    <span class="shortcut__icon shortcut__icon--butter" aria-hidden="true">▧</span>
                    <span class="shortcut__text">
                      <span class="shortcut__title">Tạo bộ sách</span>
                      <span class="shortcut__desc">Nhóm các cuốn sách liên quan</span>
                    </span>
                    <span class="shortcut__arrow" aria-hidden="true">→</span>
                  </RouterLink>

                  <RouterLink class="shortcut" to="/studio/games">
                    <span class="shortcut__icon shortcut__icon--lilac" aria-hidden="true">◈</span>
                    <span class="shortcut__text">
                      <span class="shortcut__title">Quản lý trò chơi</span>
                      <span class="shortcut__desc">Chỉnh sửa hoạt động vui học</span>
                    </span>
                    <span class="shortcut__arrow" aria-hidden="true">→</span>
                  </RouterLink>
                </div>
              </section>
            </div>

            <div class="dash__grid">
              <section class="studio__card">
                <header class="studio__card-head">
                  <div>
                    <h2>Doanh thu 7 ngày gần nhất</h2>
                    <p>Doanh thu thuần theo ngày, từ đơn đã thanh toán</p>
                  </div>
                  <span class="chart__unit">Đơn vị: VNĐ</span>
                </header>

                <div class="chart">
                  <div
                    v-for="(day, index) in days"
                    :key="day.date"
                    class="chart__column"
                    :title="`${fullDay(day.date)}: ${money(day.revenue_vnd)}`"
                  >
                    <div class="chart__track">
                      <div
                        class="chart__bar"
                        :class="{ 'chart__bar--current': index === days.length - 1 }"
                        :style="{ height: `${barHeight(day.revenue_vnd)}%` }"
                      />
                    </div>
                    <span class="chart__label">{{ weekday(day.date) }}</span>
                  </div>
                </div>
                <!-- The bars are a picture of the same numbers, so screen readers get a list. -->
                <ul class="sr-only">
                  <li v-for="day in days" :key="`sr-${day.date}`">
                    {{ fullDay(day.date) }}: {{ money(day.revenue_vnd) }}
                  </li>
                </ul>
                <p v-if="!hasDailySales" class="chart__empty">
                  {{
                    sales
                      ? 'Chưa có đơn nào được thanh toán trong 7 ngày qua.'
                      : 'Không tải được số liệu doanh thu.'
                  }}
                </p>
              </section>

              <section class="studio__card">
                <header class="studio__card-head">
                  <div>
                    <h2>Tình trạng nội dung</h2>
                    <p>Bức tranh tổng quan về nội dung của bạn</p>
                  </div>
                </header>

                <ul class="status">
                  <li v-for="row in contentRows" :key="row.label" class="status__row">
                    <span
                      class="status__dot"
                      :class="`status__dot--${row.tone}`"
                      aria-hidden="true"
                    />
                    <span class="status__label">{{ row.label }}</span>
                    <strong class="status__value">{{ row.value }}</strong>
                  </li>
                </ul>
              </section>
            </div>

            <section class="studio__card studio__card--activity">
              <div>
                <h2>Hoạt động gần đây</h2>
                <p v-if="salesFailed" class="activity__empty">
                  Không tải được giao dịch gần đây.
                </p>
                <p v-else-if="!sales?.recent.length" class="activity__empty">
                  Chưa có giao dịch nào được thanh toán.
                </p>
                <ul v-else class="activity">
                  <li v-for="order in sales.recent" :key="`${order.paid_at}-${order.title}`">
                    <span class="activity__when">{{ relativeDay(order.paid_at) }}</span>
                    <span aria-hidden="true">·</span>
                    <span>Đã bán “{{ order.title }}”</span>
                    <strong class="activity__amount">{{ money(order.amount_vnd) }}</strong>
                  </li>
                </ul>
              </div>
              <RouterLink class="studio__secondary" to="/studio/books">Xem sách của tôi →</RouterLink>
            </section>
          </template>
        </main>
      </div>
    </div>

    <UploadBookModal :open="uploadOpen" @close="uploadOpen = false" @saved="load" />
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

/* Same block shape and type scale as the other Studio screens. */
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

.studio__header-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
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

.studio__primary {
  border: 0;
  cursor: pointer;
  font-family: inherit;
  background: #397653;
  color: #fff;
  border-radius: 16px;
  padding: 12px 18px;
  font-weight: 700;
  font-size: 14px;
  text-decoration: none;
  display: inline-block;
  margin-top: 6px;
}

.studio__layout {
  display: grid;
  grid-template-columns: 250px minmax(0, 1fr);
  gap: 20px;
  margin-top: 24px;
}

.studio__state {
  background: #fff;
  border-radius: 18px;
  padding: 22px;
  margin: 0 0 16px;
  color: #34423b;
}

.studio__state--error {
  color: #b3261e;
}

.studio__state--warning {
  color: #8a6d1f;
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

.studio__secondary {
  display: inline-block;
  background: #e7f5ed;
  color: #397b62;
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  align-self: center;
}

/* ---- KPI cards -------------------------------------------------------------------- */

.dash__kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
}

.kpi {
  background: #fff;
  border-radius: 18px;
  padding: 18px;
}

.kpi__icon {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
}

.kpi__icon--mint {
  background: #e7f5ed;
  color: #397b62;
}

.kpi__icon--butter {
  background: #fff8ed;
  color: #b07e42;
}

.kpi__icon--lilac {
  background: #f2edfb;
  color: #8866a7;
}

.kpi__icon--peach {
  background: #fff0e3;
  color: #b97b67;
}

.kpi__label {
  margin: 12px 0 0;
  color: #7c8f86;
  font-size: 13px;
}

.kpi__value {
  margin: 2px 0 0;
  color: #344b42;
  font-size: 30px;
  font-weight: 700;
  line-height: 1.2;
}

/* Long money totals shrink instead of wrapping "8.450.000đ" onto two lines. */
.kpi__value--money {
  font-size: 23px;
}

.kpi__hint {
  margin: 2px 0 0;
  color: #397b62;
  font-size: 12px;
}

/* ---- Cards ------------------------------------------------------------------------ */

.dash__grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
  gap: 16px;
  margin-top: 16px;
}

.studio__card {
  background: #fff;
  border-radius: 20px;
  padding: 20px;
}

.studio__card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
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

.divider {
  height: 1px;
  background: #e9eee9;
  margin-top: 14px;
}

/* ---- Games ------------------------------------------------------------------------ */

.game__tiles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 16px;
}

.game__tile {
  border-radius: 13px;
  padding: 12px 14px;
}

.game__tile--mint {
  background: #e7f5ed;
}

.game__tile--butter {
  background: #fff8ed;
}

.game__tile--lilac {
  background: #f2edfb;
}

.game__value {
  margin: 0;
  color: #344b42;
  font-size: 27px;
  font-weight: 700;
  line-height: 1.2;
}

.game__label {
  margin: 2px 0 0;
  color: #7c8f86;
  font-size: 13px;
}

.game__newest-label {
  margin: 16px 0 0;
  font-size: 14px;
  font-weight: 700;
}

.game__newest {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-top: 10px;
}

.game__newest-icon {
  display: grid;
  place-items: center;
  width: 35px;
  height: 35px;
  border-radius: 10px;
  background: #e7f5ed;
  color: #397b62;
  flex: 0 0 auto;
}

.game__newest-title {
  flex: 1;
  min-width: 0;
  font-size: 14px;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.game__newest-status {
  color: #397b62;
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}

.game__empty {
  margin: 8px 0 0;
  color: #77847c;
  font-size: 13px;
}

/* ---- Shortcuts -------------------------------------------------------------------- */

.shortcuts {
  display: flex;
  flex-direction: column;
  margin-top: 8px;
}

.shortcut {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 0;
  border: 0;
  background: transparent;
  font: inherit;
  text-align: left;
  color: inherit;
  cursor: pointer;
  text-decoration: none;
  border-radius: 12px;
}

.shortcut:hover .shortcut__title {
  color: #397653;
}

.shortcut__icon {
  display: grid;
  place-items: center;
  width: 41px;
  height: 41px;
  border-radius: 12px;
  color: #397b62;
  font-size: 18px;
  font-weight: 700;
  flex: 0 0 auto;
}

.shortcut__icon--mint {
  background: #e7f5ed;
}

.shortcut__icon--butter {
  background: #fff8ed;
}

.shortcut__icon--lilac {
  background: #f2edfb;
}

.shortcut__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.shortcut__title {
  font-size: 14px;
  font-weight: 700;
}

.shortcut__desc {
  color: #7c8f86;
  font-size: 12px;
}

.shortcut__arrow {
  margin-left: auto;
  color: #397b62;
  font-size: 18px;
  font-weight: 700;
}

/* ---- Chart ------------------------------------------------------------------------ */

.chart__unit {
  color: #7c8f86;
  font-size: 12px;
  white-space: nowrap;
}

.chart {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-top: 18px;
  min-height: 190px;
  /* Seven bars fit a phone, but the labels must never be squeezed into each other. */
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
  /* A baseline keeps a mostly-empty week readable as a chart instead of a floating bar. */
  border-bottom: 1px solid #e9eee9;
}

.chart__bar {
  width: 100%;
  border-radius: 10px 10px 6px 6px;
  background: #cbe8d9;
}

.chart__bar--current {
  background: #6bb497;
}

.chart__label {
  color: #77847c;
  font-size: 11px;
}

.chart__empty {
  margin: 8px 0 0;
  color: #77847c;
  font-size: 13px;
}

/* ---- Content status --------------------------------------------------------------- */

.status {
  list-style: none;
  margin: 12px 0 0;
  padding: 0;
}

.status__row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  font-size: 14px;
}

.status__row + .status__row {
  border-top: 1px solid #e9eee9;
}

.status__dot {
  width: 14px;
  height: 14px;
  border-radius: 7px;
  flex: 0 0 auto;
}

.status__dot--mint {
  background: #e7f5ed;
}

.status__dot--butter {
  background: #fff8ed;
}

.status__dot--lilac {
  background: #f2edfb;
}

.status__label {
  flex: 1;
  min-width: 0;
}

.status__value {
  color: #397b62;
  font-size: 16px;
}

/* ---- Recent activity -------------------------------------------------------------- */

.studio__card--activity {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 16px;
}

.studio__card--activity h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
}

.activity {
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.activity li {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  color: #77847c;
  font-size: 13px;
}

.activity__amount {
  color: #344b42;
}

.activity__empty {
  margin: 8px 0 0;
  color: #77847c;
  font-size: 13px;
}

/* ---- Responsive ------------------------------------------------------------------- */

@media (max-width: 1100px) {
  .dash__kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .dash__grid {
    grid-template-columns: minmax(0, 1fr);
  }
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

  .studio__card--activity {
    flex-direction: column;
    align-items: flex-start;
  }
}

@media (max-width: 560px) {
  .dash__kpis {
    grid-template-columns: minmax(0, 1fr);
  }

  .game__tiles {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
