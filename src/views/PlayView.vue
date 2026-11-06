<script setup lang="ts">
import { PawPrint, Sparkles, Sprout } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BaseButton from '../components/ui/BaseButton.vue'
import { activities } from '../data/activities'
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

      <ul class="activity-grid">
        <li
          v-for="activity in activities"
          :key="activity.slug"
          class="activity-card"
          :class="`activity-card--${activity.theme}`"
        >
          <div class="activity-card__main">
            <div class="activity-card__art" aria-hidden="true">
              <PawPrint v-if="activity.theme === 'animals'" :size="34" stroke-width="2.2" />
              <Sprout v-else :size="34" stroke-width="2.2" />
            </div>
            <div class="activity-card__copy">
              <span class="activity-card__type">{{ activity.gameType }}</span>
              <h2>{{ activity.title }}</h2>
              <p>{{ activity.description }}</p>
            </div>
          </div>
          <BaseButton size="md" :to="`/play/${activity.slug}`">Chơi ngay <span class="play-card__arrow" aria-hidden="true">⟶</span></BaseButton>
        </li>
      </ul>
    </main>

    <AppFooter label="Góc vui học" />
  </div>
</template>
