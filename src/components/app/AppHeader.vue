<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Menu, Search, X } from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSession } from '../../composables/useSession'

withDefaults(
  defineProps<{
    variant?: 'overlay' | 'card'
    contrast?: 'light' | 'dark'
  }>(),
  { variant: 'overlay', contrast: 'light' },
)

const open = ref(false)
const route = useRoute()
const router = useRouter()
const session = useSession()

// "Dành cho người lớn" left the header by request: adults now arrive through Đăng nhập.
const links = [
  { label: 'Trang chủ', to: '/' },
  { label: 'Thư viện sách', to: '/library' },
  { label: 'Góc vui học', to: '/play' },
  { label: 'Về chúng tôi', to: '/about' },
]

const loginTarget = computed(() => ({
  path: '/login',
  query: { redirect: route.fullPath },
}))

const signingOut = ref(false)

const signOut = async () => {
  if (signingOut.value) return
  signingOut.value = true
  try {
    await session.logout()
    open.value = false
    if (route.path === '/login') await router.replace('/')
  } catch (err) {
    // Keep the user signed in: the session is still valid server-side.
    console.warn('Đăng xuất thất bại', err)
  } finally {
    signingOut.value = false
  }
}

onMounted(() => {
  void session.load()
})
</script>

<template>
  <header
    class="header"
    :class="[`header--${variant}`, `header--${contrast}`]"
    @keydown.esc="open = false"
  >
    <RouterLink
      class="brand"
      to="/"
      aria-label="Little Wonder Library - Trang chủ"
    >
      <img src="/images/brand-mark.svg" alt="" />
      <span>Little<br />Wonder<br />Library</span>
    </RouterLink>

    <nav class="nav" aria-label="Điều hướng chính">
      <RouterLink v-for="link in links" :key="link.to" :to="link.to">
        {{ link.label }}
      </RouterLink>
    </nav>

    <div class="header__actions">
      <RouterLink to="/library" aria-label="Tìm sách"
        ><Search :size="21"
      /></RouterLink>

      <template v-if="session.user.value">
        <RouterLink
          v-if="session.user.value.role === 'teacher'"
          class="parent"
          to="/studio"
        >
          Teacher Studio
        </RouterLink>
        <span class="parent header__user" :title="session.user.value.display_name">
          {{ session.user.value.display_name }}
        </span>
        <button type="button" class="header__signout" @click="signOut">
          Đăng xuất
        </button>
      </template>
      <RouterLink v-else class="parent" :to="loginTarget">Đăng nhập</RouterLink>

      <button
        type="button"
        class="menu"
        :aria-expanded="open"
        aria-controls="mobile-navigation"
        @click="open = !open"
      >
        <X v-if="open" :size="26" />
        <Menu v-else :size="26" />
        <span class="sr-only">{{ open ? 'Đóng menu' : 'Mở menu' }}</span>
      </button>
    </div>

    <nav
      v-show="open"
      id="mobile-navigation"
      class="mobile-nav"
      aria-label="Điều hướng di động"
    >
      <RouterLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        @click="open = false"
      >
        {{ link.label }}
      </RouterLink>
      <RouterLink
        v-if="session.user.value?.role === 'parent'"
        to="/parent/library"
        @click="open = false"
      >
        Tủ sách của bé
      </RouterLink>
      <RouterLink
        v-if="session.user.value?.role === 'teacher'"
        to="/studio"
        @click="open = false"
      >
        Teacher Studio
      </RouterLink>
      <RouterLink v-if="!session.user.value" :to="loginTarget" @click="open = false">
        Đăng nhập
      </RouterLink>
      <button v-else type="button" class="mobile-nav__signout" @click="signOut">
        Đăng xuất
      </button>
    </nav>
  </header>
</template>

<style scoped>
.header__user {
  max-width: 190px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header__signout {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
  text-decoration: underline;
  padding: 0;
}

.mobile-nav__signout {
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: 700;
  text-align: left;
  cursor: pointer;
  padding: 0;
}
</style>
