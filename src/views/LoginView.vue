<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Eye, EyeOff } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import { ApiError } from '../api/client'
import type { Role, SessionUser } from '../api/auth'
import { homeFor, useSession } from '../composables/useSession'

const route = useRoute()
const router = useRouter()
const session = useSession()

type Mode = 'login' | 'register'

const mode = ref<Mode>(route.query.mode === 'register' ? 'register' : 'login')
const role = ref<Role>('parent')
const displayName = ref('')
const email = ref('')
const password = ref('')
const showPassword = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
// Registering also signs in, but the person deserves a confirmation before the app moves
// on: the dialog waits here until they acknowledge it.
const registeredUser = ref<SessionUser | null>(null)
const continueButton = ref<HTMLButtonElement | null>(null)

const isRegister = computed(() => mode.value === 'register')
const submitLabel = computed(() => (isRegister.value ? 'Đăng ký  →' : 'Đăng nhập  →'))

// Only same-site paths can be redirect targets: "//evil.example" and "/login" are out.
const SAFE_REDIRECT = /^\/(?!login($|\?|\/))/
const safeRedirect = (raw: unknown, fallback: string): string =>
  typeof raw === 'string' && SAFE_REDIRECT.test(raw) && !raw.startsWith('//')
    ? raw
    : fallback

const messageFor = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'

  switch (err.code) {
    case 'invalid_credentials':
      return 'Email hoặc mật khẩu không đúng.'
    case 'email_taken':
      return 'Email này đã được đăng ký. Hãy đăng nhập thay vì tạo mới.'
    case 'validation':
      return 'Email hợp lệ và mật khẩu từ 8 ký tự là được nhé.'
    case 'rate_limited':
      return 'Bạn thử hơi nhanh. Đợi một phút rồi thử lại nhé.'
    case 'network':
      return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Chưa đăng nhập được. Vui lòng thử lại.'
  }
}

const toggleMode = () => {
  mode.value = isRegister.value ? 'login' : 'register'
  errorMessage.value = ''
}

const submit = async () => {
  if (submitting.value) return

  errorMessage.value = ''
  submitting.value = true
  try {
    // Register also signs in (the API sets the session cookie), so the two paths differ
    // only in which endpoint runs.
    if (isRegister.value) {
      registeredUser.value = await session.register(
        displayName.value,
        email.value,
        password.value,
        role.value,
      )
      await nextTick()
      continueButton.value?.focus()
      return
    }

    const user = await session.login(email.value, password.value)
    await router.replace(safeRedirect(route.query.redirect, homeFor(user)))
  } catch (err) {
    errorMessage.value = messageFor(err)
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void session.load().then((user) => {
    if (user) void router.replace(homeFor(user))
  })
})

const finishRegister = async () => {
  const user = registeredUser.value
  registeredUser.value = null
  if (!user) return
  // A brand-new account has nothing on its shelf yet, so the homepage is the friendlier
  // landing; an explicit ?redirect= still wins.
  await router.replace(safeRedirect(route.query.redirect, '/'))
}

</script>


<template>
  <div class="auth">
    <AppHeader />

    <div class="auth__grid">
      <section class="auth__welcome" aria-labelledby="auth-welcome-title">
        <h1 id="auth-welcome-title">Chào mừng đến với<br />thế giới truyện nhỏ!</h1>
        <img
          class="auth__art"
          src="/images/login-artwork.jpg"
          alt="Bạn cáo nhỏ đọc sách trong thư viện cây xanh"
          width="1000"
          height="562"
          loading="lazy"
        />
        <p class="auth__caption">Mỗi trang sách mở ra một hành trình kỳ diệu.</p>
      </section>

      <section class="auth__card" aria-labelledby="auth-card-title">
        <h2 id="auth-card-title">
          {{ isRegister ? 'Tạo tài khoản mới' : 'Chào mừng trở lại!' }}
        </h2>
        <p class="auth__subtitle">
          {{
            isRegister
              ? 'Chọn vai trò để tạo không gian đọc của bạn.'
              : 'Chọn vai trò để đăng nhập vào không gian của bạn.'
          }}
        </p>

        <div
          class="auth__tabs"
          role="radiogroup"
          aria-label="Vai trò khi tạo tài khoản"
        >
          <button
            type="button"
            role="radio"
            :aria-checked="role === 'parent'"
            class="auth__tab"
            :class="{ 'auth__tab--active': role === 'parent' }"
            @click="role = 'parent'"
          >
            Phụ huynh
          </button>
          <button
            type="button"
            role="radio"
            :aria-checked="role === 'teacher'"
            class="auth__tab"
            :class="{ 'auth__tab--active': role === 'teacher' }"
            @click="role = 'teacher'"
          >
            Giáo viên
          </button>
        </div>

        <form class="auth__form" @submit.prevent="submit">
          <template v-if="isRegister">
            <label class="auth__label" for="auth-name">Họ và tên</label>
            <input
              id="auth-name"
              v-model.trim="displayName"
              class="auth__input"
              type="text"
              autocomplete="name"
              placeholder="Ví dụ: Nguyễn Thị Bé"
              maxlength="80"
              aria-describedby="auth-name-hint"
              required
            />
            <p id="auth-name-hint" class="auth__field-hint">
              Tên này hiển thị ở góc phải trang, từ 1 đến 80 ký tự.
            </p>
          </template>

          <label
            class="auth__label"
            :class="{ 'auth__label--spaced': isRegister }"
            for="auth-email"
          >
            Địa chỉ email
          </label>
          <input
            id="auth-email"
            v-model.trim="email"
            class="auth__input"
            type="email"
            autocomplete="email"
            placeholder="example@gmail.com"
            required
          />

          <div class="auth__label-row">
            <label class="auth__label" for="auth-password">Mật khẩu</label>
            <span class="auth__hint" title="Chưa hỗ trợ đặt lại mật khẩu">Quên mật khẩu?</span>
          </div>
          <div class="auth__password">
            <input
              id="auth-password"
              v-model="password"
              class="auth__input auth__input--password"
              :type="showPassword ? 'text' : 'password'"
              :autocomplete="isRegister ? 'new-password' : 'current-password'"
              :placeholder="isRegister ? 'Tối thiểu 8 ký tự' : 'Nhập mật khẩu'"
              minlength="8"
              required
            />
            <button
              type="button"
              class="auth__eye"
              :aria-label="showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'"
              :aria-pressed="showPassword"
              @click="showPassword = !showPassword"
            >
              <EyeOff v-if="showPassword" :size="19" />
              <Eye v-else :size="19" />
            </button>
          </div>

          <p v-if="errorMessage" class="auth__error" role="alert">{{ errorMessage }}</p>

          <button class="auth__submit" type="submit" :disabled="submitting">
            {{ submitting ? 'Đang xử lý…' : submitLabel }}
          </button>
        </form>

        <p class="auth__switch">
          {{ isRegister ? 'Đã có tài khoản?' : 'Chưa có tài khoản?' }}
          <button type="button" class="auth__switch-link" @click="toggleMode">
            {{ isRegister ? 'Đăng nhập' : 'Đăng ký ngay' }}
          </button>
        </p>
      </section>
    </div>

    <p class="auth__footer">Dành cho phụ huynh và giáo viên · Little Wonder Library</p>

    <div
      v-if="registeredUser"
      class="success"
      role="dialog"
      aria-modal="true"
      aria-labelledby="success-title"
      @keydown.esc="finishRegister"
    >
      <div class="success__card">
        <p class="success__badge" aria-hidden="true">✓</p>
        <h2 id="success-title">Đăng ký thành công!</h2>
        <p class="success__text">
          Chào <strong>{{ registeredUser.display_name }}</strong>!
          Tài khoản <strong>{{ registeredUser.email }}</strong> đã sẵn sàng với vai trò
          {{ registeredUser.role === "teacher" ? "giáo viên" : "phụ huynh" }}.
        </p>
        <button
          ref="continueButton"
          type="button"
          class="auth__submit"
          @click="finishRegister"
        >
          Bắt đầu khám phá  →
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth {
  min-height: 100vh;
  background: #fff8ec;
  padding: 0 0 40px;
  font-family: "Nunito", system-ui, sans-serif;
}


.auth__grid {
  display: grid;
  padding: 0 40px;
  grid-template-columns: minmax(0, 590px) minmax(0, 590px);
  gap: 60px;
  justify-content: center;
  max-width: 1240px;
  margin-left: auto;
  margin-right: auto;
  margin-top: 60px;
}

.auth__welcome {
  background: #e5f1e8;
  border-radius: 36px;
  padding: 42px 50px 36px;
}

.auth__welcome h1 {
  margin: 0;
  color: #225c45;
  font-size: 32px;
  line-height: 1.25;
  font-weight: 700;
}

.auth__art {
  display: block;
  width: 100%;
  height: 319px;
  object-fit: cover;
  border-radius: 24px;
  margin-top: 38px;
}

.auth__caption {
  margin: 19px 0 0 19px;
  color: #887c71;
  font-size: 17px;
}

.auth__card {
  background: #fff;
  border: 1px solid #e5e5d9;
  border-radius: 32px;
  padding: 41px 53px 34px;
}

.auth__card h2 {
  margin: 0;
  color: #225c45;
  font-size: 32px;
  font-weight: 700;
}

.auth__subtitle {
  margin: 5px 0 0;
  color: #887c71;
  font-size: 15px;
}

.auth__tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  background: #fff8ec;
  border-radius: 18px;
  padding: 5px;
  margin-top: 28px;
  gap: 4px;
}

.auth__tab {
  border: 0;
  background: transparent;
  border-radius: 14px;
  padding: 13px 0;
  color: #887c71;
  font: inherit;
  font-weight: 700;
  font-size: 17px;
  cursor: pointer;
}

.auth__tab--active {
  background: #e5f1e8;
  color: #225c45;
}

.auth__form {
  margin-top: 26px;
  display: flex;
  flex-direction: column;
}

.auth__label {
  color: #225c45;
  font-weight: 700;
  font-size: 15px;
  margin-bottom: 8px;
}

.auth__field-hint {
  margin: 6px 0 0;
  color: #a49c93;
  font-size: 13px;
}

.auth__label--spaced {
  margin-top: 18px;
}

.auth__label-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 18px;
}

.auth__hint {
  color: #a49c93;
  font-size: 14px;
  font-weight: 700;
}

.auth__input {
  width: 100%;
  border: 1px solid #e5e5d9;
  border-radius: 14px;
  padding: 16px 18px;
  font: inherit;
  font-size: 16px;
  color: #3a332c;
  background: #fff;
}

.auth__input:focus-visible {
  outline: 2px solid #347b57;
  outline-offset: 2px;
}

.auth__password {
  position: relative;
}

.auth__input--password {
  padding-right: 52px;
}

.auth__eye {
  position: absolute;
  top: 50%;
  right: 14px;
  transform: translateY(-50%);
  border: 0;
  background: transparent;
  color: #887c71;
  cursor: pointer;
  padding: 4px;
  display: grid;
  place-items: center;
}

.auth__error {
  margin: 14px 0 0;
  color: #b3261e;
  font-size: 14px;
}

.auth__submit {
  margin-top: 26px;
  background: #347b57;
  color: #fff;
  border: 0;
  border-radius: 18px;
  padding: 18px;
  font: inherit;
  font-weight: 700;
  font-size: 19px;
  cursor: pointer;
}

.auth__submit:hover {
  background: #2c6a4a;
}

.auth__submit:disabled {
  opacity: 0.7;
  cursor: progress;
}

.auth__switch {
  margin: 26px 0 0;
  text-align: center;
  color: #887c71;
  font-size: 15px;
}

.auth__switch-link {
  border: 0;
  background: transparent;
  color: #347b57;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.auth__switch-link:hover {
  text-decoration: underline;
}

.auth__footer {
  margin-top: 40px;
  text-align: center;
  color: #887c71;
  font-size: 13px;
}

@media (max-width: 1080px) {
  .auth__grid {
    grid-template-columns: minmax(0, 1fr);
    gap: 32px;
  }

  .auth__welcome {
    display: none;
  }
}

@media (max-width: 640px) {
  .auth__grid {
    padding: 0 16px;
  }

  .auth__card {
    padding: 28px 22px;
  }

  .auth__card h2 {
    font-size: 26px;
  }
}
.success {
  position: fixed;
  inset: 0;
  background: rgba(34, 58, 43, 0.45);
  display: grid;
  place-items: center;
  padding: 24px;
  z-index: 50;
}

.success__card {
  background: #fff;
  border-radius: 28px;
  padding: 36px 40px;
  max-width: 460px;
  text-align: center;
  box-shadow: 0 24px 60px rgba(34, 58, 43, 0.24);
}

.success__badge {
  margin: 0 auto;
  width: 64px;
  height: 64px;
  border-radius: 50%;
  background: #d9f1e1;
  color: #397653;
  font-size: 32px;
  font-weight: 700;
  display: grid;
  place-items: center;
}

.success__card h2 {
  margin: 18px 0 0;
  color: #225c45;
  font-size: 26px;
  font-weight: 700;
}

.success__text {
  margin: 10px 0 0;
  color: #887c71;
  font-size: 15px;
  line-height: 1.6;
}

.success__text strong {
  color: #34423b;
}

.success__card .auth__submit {
  width: 100%;
  margin-top: 24px;
}

</style>
