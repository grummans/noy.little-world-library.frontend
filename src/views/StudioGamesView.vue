<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import { useToast } from '../composables/useToast'
import { ApiError } from '../api/client'
import {
  activityAgeLabel,
  listMyActivities,
  setActivityStatus,
  type Activity,
  type ActivityStats,
  type ActivityStatus,
} from '../api/activities'

const games = ref<Activity[]>([])
const stats = ref<ActivityStats>({ total: 0, published: 0, draft: 0, hidden: 0 })
const loading = ref(true)
const loadError = ref('')
const actionError = ref('')
const busyId = ref<number | null>(null)
const search = ref('')
const statusFilter = ref<'all' | ActivityStatus>('all')
const typeFilter = ref('')
const sort = ref<'updated' | 'title'>('updated')
const pending = ref<Activity | null>(null)
const { message: toast, show: showToast } = useToast()

const statusLabel: Record<ActivityStatus, string> = {
  published: 'Đã xuất bản',
  draft: 'Bản nháp',
  hidden: 'Đang ẩn',
}

const message = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'
  switch (err.code) {
    case 'not_publishable':
      return 'Cần mô tả, thể loại và URL nhúng Wordwall trước khi xuất bản.'
    case 'not_found':
      return 'Không tìm thấy game này, hoặc game không thuộc tài khoản của bạn.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không đổi được trạng thái game.'
  }
}

const loadMessage = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Không tải được danh sách game.'
  if (err.status === 401 || err.status === 403) return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  if (err.code === 'network') return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
  return 'Không tải được danh sách game.'
}

const load = async () => {
  loading.value = true
  loadError.value = ''
  try {
    const result = await listMyActivities()
    games.value = result.items
    stats.value = result.stats
  } catch (err) {
    loadError.value = loadMessage(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)

// The teacher's own catalog is small, so filtering and sorting happen in the browser:
// the status counters must keep describing the whole list, not the filtered view.
const gameTypes = computed(() =>
  [...new Set(games.value.map((game) => game.game_type).filter(Boolean))].sort(),
)

const visibleGames = computed(() => {
  const needle = search.value.trim().toLowerCase()
  const filtered = games.value.filter((game) => {
    if (statusFilter.value !== 'all' && game.status !== statusFilter.value) return false
    if (typeFilter.value && game.game_type !== typeFilter.value) return false
    if (!needle) return true
    return (
      game.title.toLowerCase().includes(needle) ||
      game.topic.toLowerCase().includes(needle) ||
      game.skills.some((skill) => skill.toLowerCase().includes(needle))
    )
  })

  return filtered.sort((a, b) =>
    sort.value === 'title'
      ? a.title.localeCompare(b.title, 'vi')
      : b.updated_at.localeCompare(a.updated_at),
  )
})

const filtersActive = computed(
  () => Boolean(search.value.trim() || typeFilter.value) || statusFilter.value !== 'all',
)

const clearFilters = () => {
  search.value = ''
  typeFilter.value = ''
  statusFilter.value = 'all'
}

const nextStatus = (game: Activity): { status: ActivityStatus; label: string } =>
  game.status === 'published'
    ? { status: 'hidden', label: 'Ẩn' }
    : { status: 'published', label: 'Xuất bản' }

const pendingLabel = computed(() =>
  pending.value ? nextStatus(pending.value).label : '',
)

const pendingMessage = computed(() => {
  if (!pending.value) return ''
  return pending.value.status === 'published'
    ? `“${pending.value.title}” sẽ biến khỏi Góc vui học cho tới khi bạn xuất bản lại.`
    : `“${pending.value.title}” sẽ hiện trong Góc vui học với thông tin hiện tại.`
})

const confirmStatus = async () => {
  const game = pending.value
  pending.value = null
  if (!game || busyId.value !== null) return

  const target = nextStatus(game)
  busyId.value = game.id
  actionError.value = ''
  try {
    const updated = await setActivityStatus(game.id, target.status)
    games.value = games.value.map((item) => (item.id === updated.id ? updated : item))
    stats.value = {
      ...stats.value,
      published: games.value.filter((item) => item.status === 'published').length,
      draft: games.value.filter((item) => item.status === 'draft').length,
      hidden: games.value.filter((item) => item.status === 'hidden').length,
    }
    showToast(target.status === 'published' ? 'Đã xuất bản game.' : 'Đã ẩn game.')
  } catch (err) {
    actionError.value = message(err)
  } finally {
    busyId.value = null
  }
}
</script>

<template>
  <div class="games">
    <AppHeader />

    <div class="games__shell">
      <header class="games__header">
        <nav class="games__breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink to="/studio">Teacher Studio</RouterLink>
          <span aria-hidden="true">/</span>
          <span>Góc vui học</span>
        </nav>
        <p class="games__eyebrow">
          <Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY
        </p>
        <h1 class="games__title">Quản lý game</h1>
        <p class="games__subtitle">
          Game được tạo trên Wordwall; ở đây bạn lưu thông tin, ảnh bìa và tự xuất bản.
        </p>
      </header>

      <div class="games__stats">
        <div class="games__stat games__stat--mint">
          <p class="games__stat-value">{{ stats.total }}</p>
          <p class="games__stat-label">Tổng số game</p>
        </div>
        <div class="games__stat games__stat--sky">
          <p class="games__stat-value">{{ stats.published }}</p>
          <p class="games__stat-label">Đã xuất bản</p>
        </div>
        <div class="games__stat games__stat--butter">
          <p class="games__stat-value">{{ stats.draft }}</p>
          <p class="games__stat-label">Bản nháp</p>
        </div>
        <div class="games__stat games__stat--peach">
          <p class="games__stat-value">{{ stats.hidden }}</p>
          <p class="games__stat-label">Đang ẩn</p>
        </div>
      </div>

      <div class="games__toolbar">
        <label class="games__search">
          <span class="sr-only">Tìm theo tên game, chủ đề hoặc kỹ năng</span>
          <input
            v-model="search"
            type="search"
            placeholder="⌕  Tìm theo tên game, chủ đề, kỹ năng…"
          />
        </label>
        <label class="games__field">
          <span class="sr-only">Lọc theo trạng thái</span>
          <select v-model="statusFilter">
            <option value="all">Mọi trạng thái</option>
            <option value="published">Đã xuất bản</option>
            <option value="draft">Bản nháp</option>
            <option value="hidden">Đang ẩn</option>
          </select>
        </label>
        <label class="games__field">
          <span class="sr-only">Lọc theo thể loại</span>
          <select v-model="typeFilter">
            <option value="">Mọi thể loại</option>
            <option v-for="type in gameTypes" :key="type" :value="type">{{ type }}</option>
          </select>
        </label>
        <label class="games__field">
          <span class="sr-only">Sắp xếp</span>
          <select v-model="sort">
            <option value="updated">Mới cập nhật</option>
            <option value="title">Tên A → Z</option>
          </select>
        </label>
        <button
          v-if="filtersActive"
          type="button"
          class="games__link"
          @click="clearFilters"
        >
          Xoá lọc
        </button>
        <RouterLink class="games__primary" to="/studio/games/new">＋ Thêm game</RouterLink>
      </div>

      <p v-if="actionError" class="games__state games__state--error" role="alert">
        {{ actionError }}
      </p>

      <p v-if="loading" class="games__state" role="status">Đang tải game…</p>

      <p v-else-if="loadError" class="games__state games__state--error" role="alert">
        {{ loadError }}
        <button type="button" class="games__link" @click="load">Thử lại</button>
      </p>

      <div v-else-if="!games.length" class="games__empty">
        <h2>Chưa có game nào</h2>
        <p>Thêm game Wordwall đầu tiên để Góc vui học có nội dung cho các bé.</p>
        <RouterLink class="games__primary" to="/studio/games/new">＋ Thêm game</RouterLink>
      </div>

      <template v-else>
        <div class="games__table-wrap">
          <table class="games__table">
            <caption class="sr-only">Danh sách game của bạn</caption>
            <thead>
              <tr>
                <th scope="col">GAME</th>
                <th scope="col">THỂ LOẠI</th>
                <th scope="col">ĐỘ TUỔI</th>
                <th scope="col">TRẠNG THÁI</th>
                <th scope="col">THAO TÁC</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="game in visibleGames" :key="game.id">
                <td>
                  <span class="games__cell-title">
                    <img
                      v-if="game.thumbnail_url"
                      class="games__thumb"
                      :src="game.thumbnail_url"
                      :alt="`Ảnh bìa ${game.title}`"
                      loading="lazy"
                    />
                    <span v-else class="games__thumb games__thumb--empty" aria-hidden="true">🎲</span>
                    <RouterLink class="games__name" :to="`/studio/games/${game.id}`">
                      {{ game.title }}
                    </RouterLink>
                  </span>
                </td>
                <td class="games__cell">{{ game.game_type || '—' }}</td>
                <td class="games__cell">{{ activityAgeLabel(game) }}</td>
                <td>
                  <span class="games__chip" :class="`games__chip--${game.status}`">
                    {{ statusLabel[game.status] }}
                  </span>
                </td>
                <td>
                  <span class="games__actions">
                    <RouterLink
                      class="games__action"
                      :to="`/studio/games/${game.id}`"
                      :aria-label="`Sửa ${game.title}`"
                    >
                      Sửa
                    </RouterLink>
                    <button
                      type="button"
                      class="games__action"
                      :disabled="busyId !== null"
                      :aria-label="`${nextStatus(game).label} ${game.title}`"
                      @click="pending = game"
                    >
                      {{ busyId === game.id ? '…' : nextStatus(game).label }}
                    </button>
                    <RouterLink
                      v-if="game.status === 'published'"
                      class="games__action"
                      :to="`/play/${game.slug}`"
                      :aria-label="`Xem ${game.title} ở Góc vui học`"
                    >
                      Xem
                    </RouterLink>
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <p v-if="!visibleGames.length" class="games__state">
          Không có game nào khớp bộ lọc hiện tại.
          <button type="button" class="games__link" @click="clearFilters">Xoá lọc</button>
        </p>
      </template>

      <aside class="games__hint">
        <span aria-hidden="true">☁</span>
        <p>
          Chỉ game đã xuất bản mới hiện với phụ huynh. Ảnh bìa nên là PNG/JPG/WebP gần tỷ lệ
          1.91:1.
        </p>
      </aside>
    </div>

    <ConfirmDialog
      :open="Boolean(pending)"
      :title="pending?.status === 'published' ? 'Ẩn game này?' : 'Xuất bản game này?'"
      :message="pendingMessage"
      :confirm-label="pendingLabel"
      @confirm="confirmStatus"
      @cancel="pending = null"
    />
    <AppToast :message="toast" />
  </div>
</template>

<style scoped>
.games {
  min-height: 100vh;
  background: #fff8ec;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.games__shell {
  max-width: 1080px;
  margin: 0 auto;
  padding: 24px 24px 56px;
}

.games__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.games__breadcrumb {
  display: flex;
  gap: 8px;
  color: #77847c;
  font-size: 14px;
}

.games__breadcrumb a:hover {
  color: #397653;
}

.games__eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.78px;
}

.games__title {
  margin: 0;
  color: #2e4a38;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.12;
}

.games__subtitle {
  margin: 0;
  color: #66756c;
  font-size: 16px;
}

.games__stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 16px;
  margin-top: 24px;
}

.games__stat {
  border-radius: 18px;
  padding: 18px 20px;
}

.games__stat--mint {
  background: #e7f6ec;
}

.games__stat--sky {
  background: #e8f2fb;
}

.games__stat--butter {
  background: #fdf3d8;
}

.games__stat--peach {
  background: #fdeae4;
}

.games__stat-value {
  margin: 0;
  color: #2e4a38;
  font-size: 30px;
  font-weight: 700;
}

.games__stat-label {
  margin: 4px 0 0;
  color: #66756c;
  font-size: 14px;
}

.games__toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-top: 24px;
}

.games__search {
  flex: 1 1 260px;
}

.games__search input,
.games__field select {
  width: 100%;
  border: 1px solid #e3ded2;
  border-radius: 999px;
  padding: 11px 16px;
  background: #fff;
  color: #34423b;
  font: inherit;
}

.games__field {
  flex: 0 1 180px;
}

.games__primary {
  border: 0;
  border-radius: 999px;
  padding: 12px 20px;
  background: #397653;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.games__link {
  border: 0;
  background: none;
  padding: 0;
  color: #397653;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.games__table-wrap {
  overflow-x: auto;
  margin-top: 20px;
  border-radius: 18px;
  background: #fff;
  padding: 8px 4px;
}

.games__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 15px;
}

.games__table th {
  padding: 12px 16px;
  color: #8a968f;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.6px;
  text-align: left;
}

.games__table td {
  padding: 12px 16px;
  border-top: 1px solid #f1ece1;
  vertical-align: middle;
}

.games__cell-title {
  display: flex;
  gap: 12px;
  align-items: center;
}

.games__thumb {
  width: 64px;
  height: 34px;
  border-radius: 8px;
  object-fit: cover;
  background: #f1ece1;
}

.games__thumb--empty {
  display: grid;
  place-items: center;
  font-size: 16px;
}

.games__name {
  color: #2e4a38;
  font-weight: 700;
}

.games__cell {
  color: #66756c;
}

.games__chip {
  display: inline-block;
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

.games__chip--published {
  background: #e7f6ec;
  color: #2f6f4c;
}

.games__chip--draft {
  background: #fdf3d8;
  color: #8a6a12;
}

.games__chip--hidden {
  background: #f1ece1;
  color: #77847c;
}

.games__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.games__action {
  border: 0;
  background: none;
  padding: 0;
  color: #397653;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.games__action:disabled {
  color: #a9b3ac;
  cursor: default;
}

.games__state {
  margin-top: 20px;
  color: #66756c;
}

.games__state--error {
  color: #b4462f;
}

.games__empty {
  margin-top: 24px;
  border-radius: 20px;
  background: #fff;
  padding: 32px;
  text-align: center;
}

.games__empty h2 {
  margin: 0 0 8px;
  color: #2e4a38;
}

.games__empty p {
  margin: 0 0 16px;
  color: #66756c;
}

.games__hint {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-top: 24px;
  border-radius: 18px;
  padding: 16px 20px;
  background: #f4f7f2;
  color: #66756c;
}

.games__hint p {
  margin: 0;
}
</style>
