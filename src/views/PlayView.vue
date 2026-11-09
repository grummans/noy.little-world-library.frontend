<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { PawPrint, Sparkles } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import AppSelect from '../components/app/AppSelect.vue'
import {
  activityAgeLabel,
  getActivityFacets,
  listActivities,
  type Activity,
  type ActivityFacets,
} from '../api/activities'
import { ApiError } from '../api/client'

const PAGE_SIZE = 9

const items = ref<Activity[]>([])
const facets = ref<ActivityFacets>({ game_types: [], skills: [] })
const loading = ref(true)
const loadingMore = ref(false)
const error = ref('')
const hasMore = ref(false)
const page = ref(1)

const query = ref('')
const gameType = ref('')
const skill = ref('')
const age = ref<number | null>(null)
// One age slider would be worse: games declare a range, so an exact age is what filters.
const ages = [3, 4, 5, 6, 7, 8]

const typeOptions = computed(() => [
  { value: '', label: 'Tất cả thể loại' },
  ...facets.value.game_types.map((type) => ({ value: type, label: type })),
])
const skillOptions = computed(() => [
  { value: '', label: 'Tất cả kỹ năng' },
  ...facets.value.skills.map((name) => ({ value: name, label: name })),
])
const ageOptions = [
  { value: null, label: 'Mọi độ tuổi' },
  ...ages.map((value) => ({ value, label: `${value} tuổi` })),
]

let searchTimer: number | undefined

const load = async (append = false) => {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
    page.value = 1
  }
  error.value = ''

  try {
    const result = await listActivities({
      q: query.value.trim(),
      game_type: gameType.value,
      skill: skill.value,
      age: age.value,
      page: append ? page.value + 1 : 1,
      limit: PAGE_SIZE,
    })
    items.value = append ? [...items.value, ...result.items] : result.items
    hasMore.value = result.has_more
    if (append) page.value += 1
  } catch (err) {
    error.value = err instanceof ApiError ? err.message : 'Không tải được Góc vui học.'
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

const loadMore = () => void load(true)

const filtersActive = () =>
  Boolean(query.value.trim() || gameType.value || skill.value || age.value !== null)

const resetFilters = () => {
  query.value = ''
  gameType.value = ''
  skill.value = ''
  age.value = null
}

// Text is debounced; the selects reload immediately because they are single choices.
watch([gameType, skill, age], () => void load())
watch(query, () => {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void load(), 300)
})

onMounted(async () => {
  void load()
  try {
    facets.value = await getActivityFacets()
  } catch {
    // Filters stay usable; only the dropdown options are missing.
  }
})

onBeforeUnmount(() => window.clearTimeout(searchTimer))
</script>

<template>
  <div class="play-page">
    <AppHeader variant="overlay" contrast="dark" />

    <main class="play-shell">
      <section class="play-heading" aria-labelledby="play-title">
        <nav class="play-breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Góc vui học</span>
        </nav>
        <p class="play-eyebrow"><Sparkles :size="14" aria-hidden="true" /> GÓC VUI HỌC</p>
        <h1 id="play-title">Học mà chơi, chơi mà học</h1>
        <p>Chọn một trò chơi nhỏ để bé khám phá thế giới quanh mình.</p>
      </section>

      <section class="play-filters" aria-label="Lọc trò chơi">
        <label class="play-filters__field">
          <span>Tìm trò chơi</span>
          <input v-model="query" type="search" placeholder="Nhập tên trò chơi" />
        </label>
        <div class="play-filters__field">
          <span aria-hidden="true">Thể loại</span>
          <AppSelect v-model="gameType" label="Thể loại" :options="typeOptions" />
        </div>
        <div class="play-filters__field">
          <span aria-hidden="true">Kỹ năng</span>
          <AppSelect v-model="skill" label="Kỹ năng" :options="skillOptions" />
        </div>
        <div class="play-filters__field">
          <span aria-hidden="true">Độ tuổi</span>
          <AppSelect v-model="age" label="Độ tuổi" :options="ageOptions" />
        </div>
        <button v-if="filtersActive()" class="play-filters__reset" type="button" @click="resetFilters">
          Xoá bộ lọc
        </button>
      </section>

      <p v-if="loading" role="status">Đang tải trò chơi…</p>
      <div v-else-if="error" class="play-shell--missing">
        <p>{{ error }}</p>
        <BaseButton variant="secondary" @click="load()">Thử lại</BaseButton>
      </div>
      <p v-else-if="!items.length">Chưa có trò chơi nào khớp với bộ lọc này.</p>

      <template v-else>
        <ul class="activity-grid">
          <li v-for="activity in items" :key="activity.slug" class="activity-card">
            <div class="activity-card__main">
              <div class="activity-card__art" aria-hidden="true">
                <img
                  v-if="activity.thumbnail_url"
                  :src="activity.thumbnail_url"
                  :alt="''"
                  loading="lazy"
                />
                <PawPrint v-else :size="34" stroke-width="2.2" />
              </div>
              <div class="activity-card__copy">
                <span class="activity-card__type">
                  {{ activity.game_type }} · {{ activityAgeLabel(activity) }}
                </span>
                <h2>{{ activity.title }}</h2>
                <p>{{ activity.description }}</p>
              </div>
            </div>
            <BaseButton size="md" :to="`/play/${activity.slug}`">
              Chơi ngay <span class="play-card__arrow" aria-hidden="true">⟶</span>
            </BaseButton>
          </li>
        </ul>

        <p v-if="hasMore" class="play-more">
          <BaseButton variant="secondary" :disabled="loadingMore" @click="loadMore">
            {{ loadingMore ? 'Đang tải…' : 'Xem thêm trò chơi' }}
          </BaseButton>
        </p>
      </template>
    </main>

    <AppFooter label="Góc vui học" />
  </div>
</template>
