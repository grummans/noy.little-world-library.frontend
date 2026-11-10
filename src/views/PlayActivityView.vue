<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { Maximize, Play } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import {
  activityAgeLabel,
  getActivity,
  listActivities,
  type Activity,
} from '../api/activities'
import { ApiError } from '../api/client'

const route = useRoute()

const activity = ref<Activity | null>(null)
const loadingActivity = ref(true)
const loadError = ref('')
const similar = ref<Activity[]>([])

// The iframe is only created after the child presses play: until then Wordwall gets no
// request at all, and a teacher's draft never loads a third-party player by accident.
const started = ref(false)
const loading = ref(false)
const failed = ref(false)
// Bumped on retry so the iframe mounts again instead of keeping its failed document.
const attempt = ref(0)
let timer: number | undefined
// Retry unmounts the button that was focused, so the section takes focus back.
const stage = ref<HTMLElement | null>(null)
const card = ref<HTMLElement | null>(null)
const fullscreen = ref(false)
const canFullscreen = typeof document !== 'undefined' && Boolean(document.fullscreenEnabled)

const slug = computed(() => String(route.params.slug ?? ''))
// A reply that belongs to a previous slug must not land on the current one.
let requestId = 0

const metaLine = computed(() => {
  if (!activity.value) return ''
  const parts = [activityAgeLabel(activity.value), activity.value.game_type]
  if (activity.value.skills.length) parts.push(activity.value.skills.join(' · '))
  return parts.filter(Boolean).join(' · ')
})

/**
 * The Figma sidebar shows written advice per game, but nothing in the data model carries
 * that copy (and a teacher never authors it), so every game shares one honest sentence.
 */
const parentTip =
  'Cùng bé xem qua trò chơi trước, hỏi bé thấy những gì và khuyến khích bé kể lại điều vừa học.'

const loadSimilar = async (current: Activity, id: number) => {
  similar.value = []
  try {
    const result = await listActivities({ game_type: current.game_type, limit: 4 })
    if (id !== requestId) return
    similar.value = result.items.filter((item) => item.slug !== current.slug).slice(0, 3)
  } catch {
    // The section is optional: a failed probe must not disturb the player.
  }
}

const load = async () => {
  const id = ++requestId
  loadingActivity.value = true
  loadError.value = ''
  started.value = false
  similar.value = []

  try {
    const loaded = await getActivity(slug.value)
    if (id !== requestId) return
    activity.value = loaded
    void loadSimilar(loaded, id)
  } catch (err) {
    if (id !== requestId) return
    activity.value = null
    if (!(err instanceof ApiError && err.status === 404)) {
      loadError.value = err instanceof ApiError ? err.message : 'Không tải được trò chơi.'
    }
  } finally {
    loadingActivity.value = false
  }
}

// A cross-origin frame that is blocked by CSP or the network fires no error event at
// all, so a load that never arrives counts as a failure and always leaves a way to
// Wordwall itself.
const start = () => {
  window.clearTimeout(timer)
  started.value = true
  loading.value = true
  failed.value = false
  attempt.value += 1
  timer = window.setTimeout(() => {
    if (!loading.value) return
    loading.value = false
    failed.value = true
  }, 10000)
}

const retry = () => {
  start()
  void nextTick(() => stage.value?.focus())
}

const onLoad = () => {
  window.clearTimeout(timer)
  loading.value = false
}

const onError = () => {
  window.clearTimeout(timer)
  loading.value = false
  failed.value = true
}

const toggleFullscreen = async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen()
      return
    }
    await card.value?.requestFullscreen()
  } catch {
    // Blocked by policy or an unsupported element: the stage keeps its normal size.
  }
}

const onFullscreenChange = () => {
  fullscreen.value = Boolean(document.fullscreenElement)
}

watch(slug, () => void load(), { immediate: true })

document.addEventListener('fullscreenchange', onFullscreenChange)
onBeforeUnmount(() => {
  window.clearTimeout(timer)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
})
</script>

<template>
  <div class="player">
    <AppHeader variant="overlay" contrast="dark" />

    <main v-if="loadingActivity" class="player__shell">
      <p class="player__state" role="status">Đang tải trò chơi…</p>
    </main>

    <main v-else-if="loadError" class="player__shell">
      <h1 class="player__title">Chưa tải được trò chơi</h1>
      <p class="player__state">{{ loadError }}</p>
      <BaseButton variant="secondary" @click="load()">Thử lại</BaseButton>
    </main>

    <main v-else-if="activity" class="player__shell">
      <nav class="breadcrumbs" aria-label="Đường dẫn">
        <RouterLink to="/">Trang chủ</RouterLink>
        <span aria-hidden="true">/</span>
        <RouterLink to="/play">Góc vui học</RouterLink>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{{ activity.title }}</span>
      </nav>

      <header class="player__intro">
        <h1 class="player__title">{{ activity.title }}</h1>
        <p class="player__meta">{{ metaLine }}</p>
      </header>

      <div class="player__layout">
        <section ref="stage" class="stage" aria-label="Khung trò chơi" tabindex="-1">
          <div ref="card" class="stage__card">
            <div v-if="!started" class="stage__prestart">
              <span class="stage__wordmark">WORDWALL</span>
              <p class="stage__kind">Trò chơi tương tác</p>
              <p class="stage__note">Nội dung Wordwall được nhúng tại đây khi triển khai website.</p>
              <BaseButton @click="start">
                <Play :size="16" aria-hidden="true" /> Bắt đầu trò chơi
              </BaseButton>
            </div>

            <template v-else>
              <div v-if="failed" class="stage__error" role="alert">
                <h2>Chưa tải được trò chơi</h2>
                <p>Kết nối có thể bị gián đoạn. Bé thử lại, hoặc mở trò chơi trong Wordwall.</p>
                <div class="stage__actions">
                  <BaseButton @click="retry">Thử lại</BaseButton>
                  <a class="stage__secondary" :href="activity.embed_url" target="_blank" rel="noreferrer">
                    Mở trên Wordwall
                  </a>
                </div>
              </div>

              <div v-else class="stage__frame">
                <p v-if="loading" class="stage__loading" role="status">Đang tải trò chơi…</p>
                <iframe
                  :key="attempt"
                  :src="activity.embed_url"
                  :title="`Trò chơi: ${activity.title}`"
                  allowfullscreen
                  loading="lazy"
                  @load="onLoad"
                  @error="onError"
                />
              </div>
            </template>
          </div>

          <div class="stage__foot">
            <button
              v-if="canFullscreen"
              type="button"
              class="stage__tool"
              :disabled="!started"
              @click="toggleFullscreen"
            >
              <Maximize :size="15" aria-hidden="true" />
              {{ fullscreen ? 'Thoát toàn màn hình' : 'Toàn màn hình' }}
            </button>
            <a class="stage__tool" :href="activity.embed_url" target="_blank" rel="noreferrer">
              Không tải được? Mở bằng Wordwall ↗
            </a>
          </div>
        </section>

        <aside class="about" aria-label="Thông tin trò chơi">
          <section class="about__block">
            <h2>Về trò chơi</h2>
            <p>{{ activity.description || 'Trò chơi nhỏ giúp bé luyện tập qua hình ảnh và âm thanh.' }}</p>
          </section>

          <section class="about__block">
            <h3>ĐỘ TUỔI</h3>
            <p>{{ activityAgeLabel(activity) }}</p>
          </section>

          <section class="about__block">
            <h3>KỸ NĂNG</h3>
            <p>{{ activity.skills.length ? activity.skills.join(' · ') : activity.game_type }}</p>
          </section>

          <section class="about__block about__block--tip">
            <h3>Gợi ý cho phụ huynh</h3>
            <p>{{ parentTip }}</p>
          </section>
        </aside>
      </div>

      <section v-if="similar.length" class="similar" aria-labelledby="similar-title">
        <h2 id="similar-title">Trò chơi tương tự</h2>
        <ul class="similar__list">
          <li v-for="item in similar" :key="item.slug" class="similar__game">
            <RouterLink class="similar__art" :to="`/play/${item.slug}`" tabindex="-1" aria-hidden="true">
              <img v-if="item.thumbnail_url" :src="item.thumbnail_url" alt="" loading="lazy" />
              <span v-else>{{ (item.topic || item.game_type).toUpperCase() }}</span>
            </RouterLink>
            <h3>
              <RouterLink :to="`/play/${item.slug}`">{{ item.title }}</RouterLink>
            </h3>
            <p class="similar__meta">{{ activityAgeLabel(item) }} · {{ item.game_type }}</p>
            <RouterLink class="similar__cta" :to="`/play/${item.slug}`">
              Chơi ngay <span aria-hidden="true">→</span>
            </RouterLink>
          </li>
        </ul>
      </section>
    </main>

    <main v-else class="player__shell">
      <h1 class="player__title">Không tìm thấy trò chơi</h1>
      <p class="player__state">Trò chơi này không còn trong Góc vui học.</p>
      <BaseButton to="/play">Xem các trò chơi khác</BaseButton>
    </main>

    <AppFooter label="Góc vui học" />
  </div>
</template>

<style scoped>
.player {
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

.player__shell {
  display: flex;
  flex-direction: column;
  /* Fills the viewport so the footer stays at the bottom on a short page. */
  flex: 1;
  gap: 18px;
  /* The header is an overlay, so the page needs its own top gap; the bottom one keeps the
   * content clear of the footer's border. */
  padding: 24px 0 32px;
}

.player__title {
  margin: 0;
  color: var(--green-dark);
  font-weight: 700;
  font-size: clamp(26px, 3vw, 38px);
  line-height: 1.15;
}

.player__meta {
  margin: 6px 0 0;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.player__state {
  margin: 0;
  color: var(--muted);
}

.player__layout {
  display: grid;
  grid-template-columns: minmax(0, 895fr) minmax(0, 405fr);
  gap: 24px;
  align-items: start;
}

/* Player card: the 16:9 stage with its tool row underneath. */
.stage {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px;
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 2px 12px rgba(57, 118, 83, 0.07);
}

.stage:focus-visible {
  outline-offset: 4px;
}

.stage__card {
  overflow: hidden;
  border-radius: 16px;
  background: #f5f2e8;
}

.stage__prestart {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 360px;
  padding: 40px 24px;
  flex-direction: column;
  gap: 8px;
  aspect-ratio: 16 / 9;
  text-align: center;
}

.stage__wordmark {
  color: rgba(47, 67, 56, 0.28);
  font-weight: 700;
  font-size: clamp(26px, 3vw, 40px);
  letter-spacing: 0.16em;
}

.stage__kind {
  margin: 0;
  color: var(--ink);
  font-size: 17px;
  font-weight: 800;
}

.stage__note {
  max-width: 380px;
  margin: 0 0 10px;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.5;
}

.stage__frame {
  position: relative;
  aspect-ratio: 16 / 9;
  background: #1f2a24;
}

.stage__frame iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.stage__loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0;
  background: #f5f2e8;
  color: var(--muted);
  font-size: 14px;
  font-weight: 700;
}

.stage__error {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 320px;
  padding: 36px 24px;
  flex-direction: column;
  gap: 12px;
  aspect-ratio: 16 / 9;
  text-align: center;
}

.stage__error h2 {
  margin: 0;
  color: var(--ink);
  font-size: 20px;
}

.stage__error p {
  max-width: 420px;
  margin: 0;
  color: var(--muted);
  font-size: 14px;
  line-height: 1.55;
}

.stage__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
}

.stage__secondary {
  padding: 12px 18px;
  border-radius: 999px;
  background: var(--green-soft);
  color: var(--green-dark);
  font-size: 14px;
  font-weight: 800;
}

.stage__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 6px 0;
  border-top: 1px solid #f0ece0;
}

.stage__tool {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 2px;
  border: 0;
  background: none;
  color: var(--muted);
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.stage__tool:hover:not(:disabled) {
  color: var(--green);
}

.stage__tool:disabled {
  color: #c6c9c0;
  cursor: default;
}

/* Sidebar. */
.about {
  display: flex;
  padding: 24px 26px;
  border-radius: 24px;
  background: #fff;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 2px 12px rgba(57, 118, 83, 0.07);
}

.about__block + .about__block {
  padding-top: 18px;
  border-top: 1px solid #f0ece0;
}

.about__block h2 {
  margin: 0 0 8px;
  color: var(--ink);
  font-weight: 700;
  font-size: 20px;
}

.about__block h3 {
  margin: 0 0 6px;
  color: var(--muted);
  font-size: 11.5px;
  font-weight: 800;
  letter-spacing: 0.1em;
}

.about__block p {
  margin: 0;
  color: #5f6f66;
  font-size: 14.5px;
  line-height: 1.6;
}

.about__block--tip p {
  color: #6b5b46;
}

/* Similar games. */
.similar {
  display: flex;
  margin-top: 10px;
  flex-direction: column;
  gap: 14px;
}

.similar h2 {
  margin: 0;
  color: var(--ink);
  font-weight: 700;
  font-size: 22px;
}

.similar__list {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.similar__game {
  display: flex;
  padding: 14px;
  border-radius: 18px;
  background: #fff;
  flex-direction: column;
  gap: 10px;
  box-shadow: 0 2px 10px rgba(57, 118, 83, 0.06);
}

.similar__art {
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
  border-radius: 12px;
  background: #efe7fb;
  color: rgba(47, 67, 56, 0.6);
  font-weight: 700;
  font-size: 16px;
  letter-spacing: 0.06em;
  text-align: center;
}

.similar__art img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.similar__game h3 {
  margin: 0;
  color: var(--ink);
  font-size: 17px;
  font-weight: 800;
  line-height: 1.35;
}

.similar__game h3 a:hover {
  color: var(--green);
}

.similar__meta {
  margin: 0;
  color: var(--muted);
  font-size: 12.5px;
  font-weight: 700;
}

.similar__cta {
  margin-top: auto;
  padding: 10px 0;
  border-radius: 999px;
  background: #eaf7ee;
  color: var(--green-dark);
  font-size: 14px;
  font-weight: 800;
  text-align: center;
}

.similar__cta:hover {
  background: var(--green-soft);
}

@media (max-width: 1080px) {
  .player__layout { grid-template-columns: 1fr; }
  .similar__list { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}

@media (max-width: 680px) {
  .player { padding: 0 20px 36px; }
  .similar__list { grid-template-columns: 1fr; }
  .stage__foot { flex-direction: column; align-items: flex-start; }
}
</style>
