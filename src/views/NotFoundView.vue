<script setup lang="ts">
import { RouterLink } from 'vue-router'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
</script>

<template>
  <div class="lost">
    <AppHeader />

    <main class="lost__shell">
      <p class="lost__eyebrow">404</p>
      <h1>Không tìm thấy trang này</h1>
      <p class="lost__hint">
        Đường dẫn có thể đã cũ hoặc bị gõ nhầm. Bé và phụ huynh quay lại thư viện nhé.
      </p>
      <div class="lost__actions">
        <RouterLink class="lost__primary" to="/">Về trang chủ</RouterLink>
        <RouterLink class="lost__secondary" to="/library">Vào thư viện sách</RouterLink>
      </div>
    </main>

    <AppFooter label="Không tìm thấy trang" />
  </div>
</template>

<style scoped>
.lost {
  display: flex;
  width: min(1440px, 100%);
  min-height: 100vh;
  margin: 0 auto;
  padding: 0 40px 48px;
  flex-direction: column;
  background: #fff8ec;
}

.lost__shell {
  display: flex;
  max-width: 560px;
  padding: 48px 0;
  flex-direction: column;
  gap: 10px;
}

.lost__eyebrow {
  margin: 0;
  color: #77847c;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
}

.lost__shell h1 {
  margin: 0;
  color: #2e6143;
  font-family: 'Balsamiq Sans', Nunito, sans-serif;
  font-size: clamp(26px, 3vw, 36px);
}

.lost__hint {
  margin: 0;
  color: #77847c;
  font-size: 15px;
  line-height: 1.6;
}

.lost__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 12px;
}

.lost__primary,
.lost__secondary {
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 800;
}

.lost__primary {
  background: #397653;
  color: #fff;
}

.lost__secondary {
  background: #d9f1e1;
  color: #2e6143;
}

@media (max-width: 680px) {
  .lost { padding: 0 20px 36px; }
}
</style>
