<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { Menu, Search, X } from 'lucide-vue-next'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useSession } from '../../composables/useSession'

withDefaults(
  defineProps<{
    variant?: 'overlay' | 'card'
    contrast?: 'light' | 'dark'
  }>(),
  { variant: 'overlay', contrast: 'dark' },
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

// One pill for the account: the links move into a dropdown so the header keeps one
// compact group instead of three floating pills.
const userMenuOpen = ref(false)
const userMenu = ref<HTMLElement | null>(null)

const userInitial = computed(() => {
  const name = session.user.value?.display_name?.trim() ?? ''
  return name ? name.charAt(0).toLocaleUpperCase('vi-VN') : '?'
})

// Hover opens the menu on desktop; a click that lands on an already hover-opened menu
// must not close it, or the pill feels broken to anyone who clicks instead of hovering.
const openedByHover = ref(false)

const openUserMenu = () => {
  userMenuOpen.value = true
}

// Leaving the pill cancels a pending close, so a diagonal move onto the panel (or over
// the 10px gap) never drops the menu out from under the pointer.
let closeTimer: number | undefined

const onPillEnter = () => {
  window.clearTimeout(closeTimer)
  if (userMenuOpen.value) return
  openedByHover.value = true
  userMenuOpen.value = true
}

const onPillLeave = () => {
  if (!openedByHover.value) return
  window.clearTimeout(closeTimer)
  closeTimer = window.setTimeout(() => {
    openedByHover.value = false
    userMenuOpen.value = false
  }, 140)
}

const closeUserMenu = () => {
  window.clearTimeout(closeTimer)
  openedByHover.value = false
  userMenuOpen.value = false
}

const toggleUserMenu = () => {
  if (openedByHover.value) {
    openedByHover.value = false
    return
  }
  userMenuOpen.value = !userMenuOpen.value
}

const onUserMenuKey = (event: KeyboardEvent) => {
  if (event.key === 'Escape' && userMenuOpen.value) {
    closeUserMenu()
  }
}

const onDocumentClick = (event: MouseEvent) => {
  if (!userMenuOpen.value) return
  if (!userMenu.value?.contains(event.target as Node)) closeUserMenu()
}

onMounted(() => {
  void session.load()
  document.addEventListener('click', onDocumentClick)
  window.addEventListener('keydown', onUserMenuKey)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  window.removeEventListener('keydown', onUserMenuKey)
  window.clearTimeout(closeTimer)
})

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

      <div
        v-if="session.user.value"
        ref="userMenu"
        class="user-menu"
        @mouseenter="onPillEnter"
        @mouseleave="onPillLeave"
      >
        <button
          type="button"
          class="user-menu__pill"
          :aria-expanded="userMenuOpen"
          aria-haspopup="true"
          @click="toggleUserMenu"
          @focus="openUserMenu"
        >
          <span class="user-menu__avatar" aria-hidden="true">{{ userInitial }}</span>
          <span class="user-menu__name">{{ session.user.value.display_name }}</span>
        </button>

        <div v-show="userMenuOpen" class="user-menu__panel" role="menu">
          <p class="user-menu__who">
            <strong>{{ session.user.value.display_name }}</strong>
            <span>{{ session.user.value.email }}</span>
          </p>

          <RouterLink
            v-if="session.user.value.role === 'parent'"
            class="user-menu__item"
            role="menuitem"
            to="/parent/library"
            @click="closeUserMenu"
          >
            Tủ sách của bé
          </RouterLink>
          <RouterLink
            v-if="session.user.value.role === 'parent'"
            class="user-menu__item"
            role="menuitem"
            to="/orders"
            @click="closeUserMenu"
          >
            Đơn hàng
          </RouterLink>
          <RouterLink
            v-if="session.user.value.role === 'teacher'"
            class="user-menu__item"
            role="menuitem"
            to="/studio"
            @click="closeUserMenu"
          >
            Teacher Studio
          </RouterLink>

          <button type="button" class="user-menu__item user-menu__item--signout" @click="signOut">
            Đăng xuất
          </button>
        </div>
      </div>
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
        v-if="session.user.value?.role === 'parent'"
        to="/orders"
        @click="open = false"
      >
        Đơn hàng
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
.user-menu {
  position: relative;
}

/* The panel hangs 10px below the pill. Without this bridge the pointer crosses empty
   space, mouseleave fires, and the menu closes before it can be reached. */
.user-menu::after {
  position: absolute;
  top: 100%;
  right: 0;
  left: 0;
  height: 10px;
  content: '';
}

.user-menu__pill {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: 48px;
  padding: 9px 16px 7px 8px;
  border: 0;
  border-radius: 16px;
  background: #d9f1e1;
  color: #397653;
  font: inherit;
  font-weight: 800;
  cursor: pointer;
}

.user-menu__pill:hover {
  background: #c8e9d5;
}

.user-menu__avatar {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #397653;
  color: #fff;
  font-size: 15px;
}

.user-menu__name {
  max-width: 170px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.user-menu__panel {
  position: absolute;
  top: calc(100% + 10px);
  right: 0;
  z-index: 10;
  min-width: 240px;
  padding: 8px;
  border-radius: 18px;
  background: #fff;
  box-shadow: 0 12px 34px rgba(34, 58, 43, 0.22);
}

.user-menu__who {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: 0 0 6px;
  padding: 10px 12px;
  border-bottom: 1px solid #eef3ec;
}

.user-menu__who strong {
  font-size: 15px;
  color: #34423b;
}

.user-menu__who span {
  font-size: 12px;
  color: #77847c;
  word-break: break-all;
}

.user-menu__item {
  display: block;
  width: 100%;
  padding: 11px 12px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: #34423b;
  font: inherit;
  font-size: 14px;
  font-weight: 700;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.user-menu__item:hover {
  background: #f2f8ef;
}

.user-menu__item--signout {
  color: #b3261e;
}

@media (max-width: 900px) {
  /* The burger menu already carries these; keeping them here squeezes the header. */
  .user-menu {
    display: none;
  }

  .header__actions .parent {
    display: none;
  }
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
