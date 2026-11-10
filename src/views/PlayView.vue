<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RotateCcw, Search, Sparkles } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import FilterSelect from '../components/ui/FilterSelect.vue'
import {
  activityAgeLabel,
  getActivityFacets,
  listActivities,
  type Activity,
  type ActivityFacets,
} from '../api/activities'
import { ApiError } from '../api/client'

const PAGE_SIZE = 10

const items = ref<Activity[]>([])
const facets = ref<ActivityFacets>({ game_types: [], skills: [], topics: [] })
const total = ref(0)
const loading = ref(true)
const error = ref('')
const page = ref(1)
// A failed page request leaves `page` on the last good one; retry needs the target.
const failedPage = ref(1)

const query = ref('')
const topic = ref('')
const gameType = ref('')
const skill = ref('')
const age = ref('')
// Games declare a range, so an exact age is what filters them; a slider would hide matches.
const ages = [3, 4, 5, 6, 7, 8]

// Facets arrive after mount, so these must stay computed — a plain array would freeze the
// empty list read at setup time.
const typeOptions = computed(() => [
  { value: '', label: 'Tất cả' },
  ...facets.value.game_types.map((type) => ({ value: type, label: type })),
])
const skillOptions = computed(() => [
  { value: '', label: 'Tất cả' },
  ...facets.value.skills.map((name) => ({ value: name, label: name })),
])
const topicOptions = computed(() => [
  { value: '', label: 'Tất cả' },
  ...facets.value.topics.map((name) => ({ value: name, label: name })),
])
const ageOptions = [
  { value: '', label: 'Tất cả' },
  ...ages.map((value) => ({ value: String(value), label: `${value} tuổi` })),
]

const filtersActive = () =>
  Boolean(query.value.trim() || topic.value || gameType.value || skill.value || age.value)

// Figma pitches one game above the grid. It is only a presentation of page 1 with no
// filters, so a filtered search never hides a result inside the panel.
const featured = computed(() =>
  page.value === 1 && !filtersActive() ? (items.value[0] ?? null) : null,
)
const gridItems = computed(() => (featured.value ? items.value.slice(1) : items.value))

const pageCount = computed(() => Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const pageButtons = computed(() => {
  const last = pageCount.value
  const start = Math.min(Math.max(1, page.value - 2), Math.max(1, last - 4))
  return Array.from({ length: Math.min(5, last) }, (_, index) => start + index)
})

const rangeLabel = computed(() => {
  if (!total.value) return 'Chưa có trò chơi nào'
  const first = (page.value - 1) * PAGE_SIZE + 1
  return `Hiển thị ${first}–${first + items.value.length - 1} trong ${total.value} trò chơi`
})

/** Figma's card art is a pastel block with a word, used when a game has no thumbnail. */
const motif = (activity: Activity) => (activity.topic || activity.game_type).toUpperCase()
const artTone = (index: number) => `art--${index % 5}`

let searchTimer: number | undefined
// Only the newest request may write to the list: a slow page 1 must not land on page 3.
let requestId = 0

const load = async (target = page.value) => {
  const id = ++requestId
  loading.value = true
  error.value = ''

  try {
    const result = await listActivities({
      q: query.value.trim(),
      topic: topic.value,
      game_type: gameType.value,
      skill: skill.value,
      age: age.value ? Number(age.value) : null,
      page: target,
      limit: PAGE_SIZE,
    })
    if (id !== requestId) return
    items.value = result.items
    total.value = result.total
    page.value = target
  } catch (err) {
    if (id !== requestId) return
    items.value = []
    total.value = 0
    failedPage.value = target
    error.value = err instanceof ApiError ? err.message : 'Không tải được Góc vui học.'
  } finally {
    if (id === requestId) loading.value = false
  }
}

const goToPage = (target: number) => {
  if (target === page.value || target < 1 || target > pageCount.value) return
  void load(target)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const resetFilters = () => {
  query.value = ''
  topic.value = ''
  gameType.value = ''
  skill.value = ''
  age.value = ''
}

// Text is debounced; a chip or a select reloads immediately because it is one click.
watch([topic, gameType, skill, age], () => {
  window.clearTimeout(searchTimer)
  void load(1)
})
watch(query, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void load(1), 300)
})

onMounted(async () => {
  void load(1)
  try {
    facets.value = await getActivityFacets()
  } catch {
    // The search box still works; only the dropdown options and chips are missing.
  }
})

onBeforeUnmount(() => window.clearTimeout(searchTimer))
</script>

<template>
  <div class="library">
    <AppHeader variant="overlay" contrast="dark" />

    <main class="library__shell">
      <nav class="breadcrumbs" aria-label="Đường dẫn">
        <RouterLink to="/">Trang chủ</RouterLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">Góc vui học</span>
      </nav>

      <section class="library__intro" aria-labelledby="play-title">
        <h1 id="play-title">Góc vui học của bé</h1>
        <p>Khám phá trò chơi thú vị, luyện kỹ năng mỗi ngày.</p>
      </section>

      <div class="book-filters" role="search" aria-label="Tìm và lọc trò chơi">
        <label class="search-field">
          <Search class="search-field__icon" :size="20" aria-hidden="true" />
          <span class="sr-only">Tìm trò chơi theo tên hoặc chủ đề</span>
          <input
            v-model="query"
            type="search"
            placeholder="Tìm trò chơi theo tên hoặc chủ đề..."
            autocomplete="off"
          />
        </label>

        <FilterSelect
          id="play-filter-age"
          class="filter--age"
          label="Độ tuổi"
          :model-value="age"
          :options="ageOptions"
          @update:model-value="age = $event"
        />
        <FilterSelect
          id="play-filter-type"
          label="Thể loại"
          :model-value="gameType"
          :options="typeOptions"
          @update:model-value="gameType = $event"
        />
        <FilterSelect
          id="play-filter-skill"
          class="filter--age"
          label="Kỹ năng"
          :model-value="skill"
          :options="skillOptions"
          @update:model-value="skill = $event"
        />

        <FilterSelect
          id="play-filter-topic"
          label="Chủ đề"
          :model-value="topic"
          :options="topicOptions"
          @update:model-value="topic = $event"
        />

        <button type="button" class="filter-reset" @click="resetFilters">
          <span>Đặt lại bộ lọc</span>
          <RotateCcw :size="17" aria-hidden="true" />
        </button>
      </div>


      <p v-if="loading" class="library__state" role="status">Đang tải trò chơi…</p>

      <section v-else-if="error" class="library__state">
        <p>{{ error }}</p>
        <BaseButton variant="secondary" @click="load(failedPage)">Thử lại</BaseButton>
      </section>

      <p v-else-if="!items.length" class="library__state">
        Chưa có trò chơi nào khớp với bộ lọc này.
        <button v-if="filtersActive()" type="button" class="chip chip--reset" @click="resetFilters">
          Xoá bộ lọc
        </button>
      </p>

      <template v-else>
        <RouterLink
          v-if="featured"
          class="featured"
          :to="`/play/${featured.slug}`"
          :aria-label="`Khám phá ${featured.title}`"
        >
          <div class="featured__copy">
            <span class="featured__badge"><Sparkles :size="13" aria-hidden="true" /> TRÒ CHƠI NỔI BẬT</span>
            <h2>{{ featured.title }}</h2>
            <p>{{ featured.description }}</p>
            <p class="featured__meta">
              {{ activityAgeLabel(featured) }} · {{ featured.game_type }}
              <template v-if="featured.skills.length"> · {{ featured.skills.join(' · ') }}</template>
            </p>
            <span class="featured__cta">Khám phá <span aria-hidden="true">→</span></span>
          </div>
          <div class="featured__art" aria-hidden="true">
            <img v-if="featured.thumbnail_url" :src="featured.thumbnail_url" alt="" />
            <template v-else>
              <span class="featured__motif">{{ motif(featured) }}</span>
              <span class="featured__dot" />
            </template>
          </div>
        </RouterLink>

        <div class="section-head">
          <h2>Trò chơi dành cho bé</h2>
          <p>{{ total }} trò chơi · {{ PAGE_SIZE }}/trang</p>
        </div>

        <ul class="games">
          <li v-for="(activity, index) in gridItems" :key="activity.slug" class="game">
            <RouterLink class="game__art" :class="artTone(index)" :to="`/play/${activity.slug}`" tabindex="-1" aria-hidden="true">
              <img v-if="activity.thumbnail_url" :src="activity.thumbnail_url" alt="" loading="lazy" />
              <span v-else class="game__motif">{{ motif(activity) }}</span>
            </RouterLink>
            <h3>
              <RouterLink :to="`/play/${activity.slug}`">{{ activity.title }}</RouterLink>
            </h3>
            <p class="game__meta">
              {{ activityAgeLabel(activity) }} · {{ activity.game_type }}
            </p>
            <RouterLink class="game__cta" :to="`/play/${activity.slug}`">
              Khám phá <span aria-hidden="true">→</span>
            </RouterLink>
          </li>
        </ul>

        <div class="pager">
          <p>{{ rangeLabel }}</p>
          <nav v-if="pageCount > 1" class="pager__nav" aria-label="Chuyển trang">
            <button
              type="button"
              class="pager__step"
              :disabled="page === 1"
              aria-label="Trang trước"
              @click="goToPage(page - 1)"
            >
              ‹
            </button>
            <button
              v-for="number in pageButtons"
              :key="number"
              type="button"
              class="pager__page"
              :class="{ 'pager__page--active': number === page }"
              :aria-current="number === page ? 'page' : undefined"
              @click="goToPage(number)"
            >
              {{ number }}
            </button>
            <button
              type="button"
              class="pager__step"
              :disabled="page === pageCount"
              aria-label="Trang sau"
              @click="goToPage(page + 1)"
            >
              ›
            </button>
          </nav>
        </div>
      </template>
    </main>

    <AppFooter label="Góc vui học" />
  </div>
</template>

<style scoped>
.library {
  --green: #397653;
  --green-dark: #2e6143;
  --green-soft: #d9f1e1;
  --cream: #fff8ec;
  --ink: #2f4338;
  --muted: #77847c;
  display: flex;
  width: min(1440px, 100%);
  min-height: 100vh;
  margin: 0 auto;
  /* Bottom spacing belongs to the footer, so the page wrapper must not add its own. */
  padding: 0 40px;
  flex-direction: column;
  background: var(--cream);
}

.library__shell {
  display: flex;
  flex-direction: column;
  /* Fills the viewport so the footer stays at the bottom on a short page. */
  flex: 1;
  gap: 24px;
  /* Breathing room above the footer's top border on both short and long pages. */
  padding: 24px 0 32px;
}

.library__intro h1 {
  margin: 0 0 8px;
  color: var(--green-dark);
  font-size: 40px;
  font-weight: 700;
  line-height: 1.12;
}

.library__intro p {
  margin: 0;
  color: var(--muted);
  font-size: 16px;
}

/* Search + filters reuse the library toolbar styles from style.css, so both pages match. The
 * toolbar itself is capped at 1196px there; here it should line up with the cards, edge to edge. */
.book-filters {
  width: 100%;
}

/* "Xoá bộ lọc" in the empty state keeps the pill look. */
.chip {
  padding: 10px 20px;
  border: 1px solid #eae6da;
  border-radius: 999px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
}

.chip:hover {
  border-color: var(--green-soft);
  background: #f4fbf6;
}

.chip--reset {
  margin-left: 6px;
  font-size: 13px;
}

.library__state {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 14px;
  margin: 0;
  padding: 40px 0;
  color: var(--muted);
}

/* Featured panel. */
.featured {
  display: grid;
  grid-template-columns: minmax(0, 1.15fr) minmax(0, 1fr);
  gap: 28px;
  padding: 32px 34px;
  border-radius: 24px;
  background: #efe7fb;
}

.featured__copy {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.featured__badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green-dark);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
}

.featured__copy h2 {
  margin: 0;
  color: var(--ink);
  font-weight: 700;
  font-size: clamp(24px, 2.4vw, 32px);
  line-height: 1.2;
}

.featured__copy p {
  margin: 0;
  color: #5f6f66;
  font-size: 15px;
  line-height: 1.55;
}

.featured__meta {
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.featured__cta {
  margin-top: 4px;
  padding: 13px 24px;
  border-radius: 999px;
  background: var(--green);
  color: #fff;
  font-size: 15px;
  font-weight: 800;
}

.featured:hover .featured__cta {
  background: var(--green-dark);
}

.featured__art {
  position: relative;
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 9;
  border-radius: 18px;
  background: #ffd9bd;
}

.featured__art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.featured__motif {
  padding: 0 18px;
  color: #b4652a;
  font-weight: 700;
  font-size: clamp(22px, 2.6vw, 34px);
  letter-spacing: 0.06em;
  text-align: center;
}

.featured__dot {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 76px;
  height: 76px;
  margin: -38px 0 0 -38px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.55);
}

.section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
}

.section-head h2 {
  margin: 0;
  color: var(--ink);
  font-weight: 700;
  font-size: 22px;
}

.section-head p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

/* Card grid: five columns on desktop, as in Figma. */
.games {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 20px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.game {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(57, 118, 83, 0.06);
}

.game__art {
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  aspect-ratio: 228 / 157;
  border-radius: 12px;
  background: #f3efe4;
}

.game__art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.art--0 { background: #ffe6cc; }
.art--1 { background: #e7f4d8; }
.art--2 { background: #e3e9fb; }
.art--3 { background: #fbe4ef; }
.art--4 { background: #fdf0c9; }

.game__motif {
  padding: 0 10px;
  color: rgba(47, 67, 56, 0.62);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.06em;
  text-align: center;
}

.game h3 {
  margin: 0;
  color: var(--ink);
  font-size: 16px;
  font-weight: 800;
  line-height: 1.35;
}

.game h3 a:hover {
  color: var(--green);
}

.game__meta {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 700;
}

.game__cta {
  margin-top: auto;
  padding: 10px 0;
  border-radius: 999px;
  background: #eaf7ee;
  color: var(--green-dark);
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.game__cta:hover {
  background: var(--green-soft);
}

/* Pager. */
.pager {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 6px;
}

.pager p {
  margin: 0;
  color: var(--muted);
  font-size: 13px;
  font-weight: 700;
}

.pager__nav {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 999px;
  background: #fff;
  box-shadow: 0 2px 10px rgba(57, 118, 83, 0.06);
}

.pager__page,
.pager__step {
  min-width: 36px;
  height: 36px;
  padding: 0 8px;
  border: 0;
  border-radius: 999px;
  background: none;
  color: var(--ink);
  font: inherit;
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
}

.pager__page:hover,
.pager__step:hover:not(:disabled) {
  background: #f1f7f2;
}

.pager__page--active,
.pager__page--active:hover {
  background: var(--green);
  color: #fff;
}

.pager__step:disabled {
  color: #c6c9c0;
  cursor: default;
}

@media (max-width: 1200px) {
  .games { grid-template-columns: repeat(4, minmax(0, 1fr)); }
}

@media (max-width: 980px) {
  .library { padding: 0 24px 40px; }
  .games { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  .featured { grid-template-columns: 1fr; }
}

@media (max-width: 680px) {
  .games { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .library__intro h1 { font-size: 28px; }
  /* The count sits under the title on a phone instead of squeezing onto one line. */
  .section-head {
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
  }
  .pager { flex-direction: column; align-items: stretch; }
  .pager__nav { justify-content: center; }
}
</style>
