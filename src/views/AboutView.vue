<script setup lang="ts">
import { BookOpen, Sparkles } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import AppFooter from '../components/app/AppFooter.vue'
import BaseButton from '../components/ui/BaseButton.vue'

const authors = [
  { name: 'Trương Thu Huyền', initials: 'TH', note: 'Khoa Giáo dục Mầm non\nTrường Đại học Sư phạm Hà Nội 2' },
  { name: 'Dương Hoài Thương', initials: 'HT', note: 'Khoa Giáo dục Mầm non\nTrường Đại học Sư phạm Hà Nội 2' },
  { name: 'Bùi Thị Thanh Thảo', initials: 'TT', note: 'Khoa Giáo dục Mầm non\nTrường Đại học Sư phạm Hà Nội 2' },
  { name: 'TS. Vũ Kiều Anh', initials: 'KA', note: 'Khoa Giáo dục Mầm non\nTrường Đại học Sư phạm Hà Nội 2' },
]
</script>

<template>
  <div class="about-page">
    <AppHeader variant="overlay" contrast="dark" />

    <main class="about-shell">
      <section class="about-intro" aria-labelledby="about-title">
        <nav class="about-breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <span>Về chúng tôi</span>
        </nav>

        <div class="about-intro__body">
          <div class="about-copy">
            <p class="about-eyebrow"><Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY</p>
            <h1 id="about-title">Về chúng tôi</h1>
            <p class="about-purpose">Một thư viện nhỏ,<br /><span>mở ra bao điều kỳ diệu.</span></p>
            <p class="about-copy__text">
              Little Wonder Library là thư viện sách tương tác dành cho trẻ em, nơi bé khám phá động
              vật, thiên nhiên, cảm xúc, kỹ năng sống và gia đình qua hình ảnh, âm thanh và những câu
              chuyện gần gũi.
            </p>
            <p class="about-copy__text">
              Chúng tôi mong mỗi lần mở sách là một dịp để bé tò mò, tưởng tượng và cùng người lớn trò
              chuyện về thế giới quanh mình.
            </p>
          </div>

          <figure class="about-figure">
            <img
              src="/images/about-bunny-storytime.jpg"
              alt="Chú thỏ đọc sách giữa khu vườn kỳ diệu"
              width="1264"
              height="848"
            />
            <figcaption>Mỗi trang sách, một thế giới để khám phá.</figcaption>
          </figure>

        </div>
      </section>

      <section class="about-authors" aria-labelledby="authors-title">
        <p class="about-eyebrow">NHÓM TÁC GIẢ</p>
        <h2 id="authors-title">Cùng làm nên Little Wonder Library</h2>
        <p class="about-authors__lead">
          Xin chào! Chúng tôi là nhóm tác giả của thư viện sách tương tác này.
        </p>
        <ul class="author-list">
          <li v-for="author in authors" :key="author.name" class="author-card">
            <span class="author-card__monogram" aria-hidden="true">{{ author.initials }}</span>
            <h3>{{ author.name }}</h3>
            <span v-if="author.note" class="author-card__note">{{ author.note }}</span>
          </li>
        </ul>
      </section>

      <section class="about-invite" aria-labelledby="invite-title">
        <span class="about-invite__symbol" aria-hidden="true"><BookOpen :size="34" /></span>
        <div class="about-invite__copy">
          <h2 id="invite-title">Câu chuyện tiếp theo đang chờ bé!</h2>
          <p>Cùng bé chọn một cuốn sách và bắt đầu chuyến phiêu lưu nhỏ hôm nay.</p>
        </div>
        <BaseButton to="/library">Khám phá thư viện</BaseButton>
      </section>

      <AppFooter label="Về chúng tôi" />
    </main>
  </div>
</template>
