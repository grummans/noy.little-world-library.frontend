<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { activityAgeLabel, getActivity, type Activity } from '../api/activities'
import { ApiError } from '../api/client'

const route = useRoute()

const activity = ref<Activity | null>(null)
const loadingActivity = ref(true)
const loadError = ref('')

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

const slug = computed(() => String(route.params.slug ?? ''))

const load = async () => {
  loadingActivity.value = true
  loadError.value = ''
  started.value = false

  try {
    activity.value = await getActivity(slug.value)
  } catch (err) {
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

watch(slug, () => void load(), { immediate: true })

onBeforeUnmount(() => window.clearTimeout(timer))
</script>

<template>
  <div class="play-page">
    <AppHeader variant="overlay" contrast="dark" />

    <main v-if="loadingActivity" class="play-shell">
      <p role="status">Đang tải trò chơi…</p>
    </main>

    <main v-else-if="loadError" class="play-shell play-shell--missing">
      <h1>Chưa tải được trò chơi</h1>
      <p>{{ loadError }}</p>
      <BaseButton variant="secondary" @click="load()">Thử lại</BaseButton>
    </main>

    <main v-else-if="activity" class="play-shell">
      <section class="play-heading" aria-labelledby="play-title">
        <nav class="play-breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink to="/play">Góc vui học</RouterLink>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{{ activity.title }}</span>
        </nav>
        <h1 id="play-title">{{ activity.title }}</h1>
        <p>{{ activity.description }}</p>
        <p class="activity-meta">
          {{ activity.game_type }} · {{ activityAgeLabel(activity) }}
          <template v-if="activity.topic"> · {{ activity.topic }}</template>
        </p>
      </section>

      <section ref="stage" class="play-stage" aria-label="Khung trò chơi" tabindex="-1">
        <div v-if="!started" class="play-start">
          <p>Sẵn sàng chưa? Trò chơi mở trong khung ngay tại đây.</p>
          <BaseButton @click="start">Bắt đầu chơi</BaseButton>
        </div>

        <template v-else>
          <div v-if="failed" class="play-stage__error" role="alert">
            <h2>Chưa tải được trò chơi</h2>
            <p>Kết nối có thể bị gián đoạn. Bé thử lại, hoặc mở trò chơi trong Wordwall.</p>
            <div class="play-stage__actions">
              <BaseButton @click="retry">Thử lại</BaseButton>
              <a class="button button--secondary" :href="activity.embed_url" target="_blank" rel="noreferrer">
                Mở trên Wordwall
              </a>
            </div>
          </div>

          <div v-else class="play-frame">
            <p v-if="loading" class="play-frame__loading" role="status">Đang tải trò chơi…</p>
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

          <p class="play-fallback">
            Trò chơi không hiện?
            <a :href="activity.embed_url" target="_blank" rel="noreferrer">Mở trên Wordwall</a>
            <button class="play-fallback__retry" type="button" @click="retry">Tải lại</button>
          </p>
        </template>
      </section>
    </main>

    <main v-else class="play-shell play-shell--missing">
      <h1>Không tìm thấy trò chơi</h1>
      <p>Trò chơi này không còn trong Góc vui học.</p>
      <BaseButton to="/play">Xem các trò chơi khác</BaseButton>
    </main>

    <AppFooter label="Góc vui học" />
  </div>
</template>
