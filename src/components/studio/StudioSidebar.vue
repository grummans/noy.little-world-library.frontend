<script setup lang="ts">
// One sidebar for every Teacher Studio screen, so the left column never disappears when a
// teacher opens bundles, games or a book's file page.
//
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const onStudioHome = computed(
  () => route.path === '/studio' || route.path.startsWith('/studio/books'),
)
const onBundles = computed(() => route.path.startsWith('/studio/bundles'))
const onGames = computed(() => route.path.startsWith('/studio/games'))
const onRevenue = computed(() => route.path.startsWith('/studio/revenue'))
</script>

<template>
  <nav class="sidebar" aria-label="Không gian giáo viên">
    <p class="sidebar__title">KHÔNG GIAN GIÁO VIÊN</p>
    <RouterLink class="sidebar__nav" to="/studio">▦ Tổng quan</RouterLink>
    <RouterLink class="sidebar__nav" :class="{ 'sidebar__nav--active': onStudioHome }" to="/studio">
      📚 Sách của tôi
    </RouterLink>
    <RouterLink
      class="sidebar__nav"
      :class="{ 'sidebar__nav--active': onBundles }"
      to="/studio/bundles"
    >
      ◈ Gói sách
    </RouterLink>
    <RouterLink
      class="sidebar__nav"
      :class="{ 'sidebar__nav--active': onGames }"
      to="/studio/games"
    >
      🎮 Quản lý game
    </RouterLink>
    <RouterLink
      class="sidebar__nav"
      :class="{ 'sidebar__nav--active': onRevenue }"
      to="/studio/revenue"
    >
      📊 Thống kê doanh thu
    </RouterLink>
    <span class="sidebar__nav sidebar__nav--muted">⚙ Hồ sơ &amp; cài đặt</span>

    <aside class="sidebar__hint">
      <p class="sidebar__hint-title">GÓI SÁCH CỦA BẠN</p>
      <p>Chỉ chọn các sách đã xuất bản do bạn tạo.</p>
    </aside>
  </nav>
</template>

<style scoped>
.sidebar {
  background: #fff;
  border-radius: 20px;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  align-self: start;
  font-family: 'Nunito', system-ui, sans-serif;
}

.sidebar__title {
  margin: 0;
  color: #77847c;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sidebar__nav {
  color: #34423b;
  font-size: 15px;
  text-decoration: none;
}

.sidebar__nav:hover {
  color: #397653;
}

.sidebar__nav--active {
  color: #397653;
  font-weight: 700;
}

.sidebar__nav--muted {
  color: #a49c93;
}

.sidebar__hint {
  margin-top: 10px;
  border-radius: 18px;
  padding: 16px;
  background: #e6ddf9;
  color: #4c4370;
  font-size: 14px;
}

.sidebar__hint-title {
  margin: 0 0 6px;
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.04em;
}

.sidebar__hint p {
  margin: 0;
}

@media (max-width: 1024px) {
  .sidebar {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
  }

  /* Each nav item keeps its own line: wrapping them inline reads as one run-on label. */
  .sidebar__nav,
  .sidebar__hint {
    flex: 1 1 100%;
  }
}
</style>
