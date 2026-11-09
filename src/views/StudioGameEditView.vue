<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink, onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import AppHeader from '../components/app/AppHeader.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import { useToast } from '../composables/useToast'
import { ApiError } from '../api/client'
import {
  createActivity,
  getActivityFacets,
  getMyActivity,
  isWordwallEmbedURL,
  setActivityStatus,
  updateActivity,
  uploadActivityThumbnail,
  type Activity,
  type ActivityMetadata,
} from '../api/activities'

const route = useRoute()
const router = useRouter()
const routeID = computed(() => String(route.params.id))
const isNew = computed(() => routeID.value === 'new')
const activityID = computed(() => Number(routeID.value))

const activity = ref<Activity | null>(null)
const loading = ref(!isNew.value)
const loadError = ref('')

const form = ref({
  title: '',
  embed_url: '',
  game_type: '',
  topic: '',
  skills: '',
  age_min: '' as string,
  age_max: '' as string,
  description: '',
})
const thumbnail = ref<File | null>(null)
const thumbnailPreview = ref('')
const thumbnailInput = ref<HTMLInputElement | null>(null)
const gameTypeOptions = ref<string[]>([])

const saving = ref(false)
const formError = ref('')
const formNote = ref('')
const pendingAction = ref<'save' | 'publish' | 'hide' | null>(null)
const { message: toast, show: showToast } = useToast()

const previewOpen = ref(false)
const previewSrc = ref('')
const previewAttempt = ref(0)
const previewLoading = ref(false)
const previewFailed = ref(false)
let previewTimer: number | undefined

const status = computed(() => activity.value?.status ?? 'draft')
const isPublished = computed(() => status.value === 'published')

const embedValid = computed(() => isWordwallEmbedURL(form.value.embed_url))
const embedTouched = computed(() => form.value.embed_url.trim().length > 0)

// The card preview must reflect unsaved edits, so the label comes from the form, not the row.
const ageLabel = computed(() => {
  const min = form.value.age_min === '' ? null : Number(form.value.age_min)
  const max = form.value.age_max === '' ? null : Number(form.value.age_max)
  if (min !== null && max !== null) return `${min}–${max} tuổi`
  if (min !== null) return `Từ ${min} tuổi`
  if (max !== null) return `Đến ${max} tuổi`
  return 'Mọi độ tuổi'
})

const skillsList = computed(() =>
  form.value.skills
    .split(',')
    .map((skill) => skill.trim())
    .filter(Boolean),
)

const message = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Có lỗi xảy ra, vui lòng thử lại.'
  switch (err.code) {
    case 'slug_taken':
      return 'Đường dẫn tạo từ tên game đã tồn tại. Đổi tên game một chút rồi lưu lại.'
    case 'not_publishable':
      return 'Cần mô tả, thể loại và URL nhúng Wordwall trước khi xuất bản.'
    case 'invalid_file':
      return 'Ảnh bìa không hợp lệ: cần PNG/JPG/WebP gần tỷ lệ 1.91:1 và dưới 5 MB.'
    case 'validation':
      return err.message || 'Thông tin chưa hợp lệ, kiểm tra lại các ô đang báo lỗi.'
    case 'not_found':
      return 'Không tìm thấy game này, hoặc game không thuộc tài khoản của bạn.'
    case 'storage_unavailable':
      return 'Máy chủ lưu trữ chưa sẵn sàng. Thử lại sau ít phút.'
    case 'network':
      return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
    default:
      return 'Không lưu được thay đổi. Vui lòng thử lại.'
  }
}

onMounted(async () => {
  getActivityFacets()
    .then((facets) => (gameTypeOptions.value = facets.game_types))
    .catch(() => {})

  if (isNew.value) {
    savedForm.value = formSnapshot()
    return
  }

  try {
    const loaded = await getMyActivity(activityID.value)
    activity.value = loaded
    form.value = {
      title: loaded.title,
      embed_url: loaded.embed_url,
      game_type: loaded.game_type,
      topic: loaded.topic,
      skills: loaded.skills.join(', '),
      age_min: loaded.age_min === null ? '' : String(loaded.age_min),
      age_max: loaded.age_max === null ? '' : String(loaded.age_max),
      description: loaded.description,
    }
    thumbnailPreview.value = loaded.thumbnail_url
    savedForm.value = formSnapshot()
  } catch (err) {
    loadError.value = message(err)
  } finally {
    loading.value = false
  }
})

// A typed-in form that is thrown away without a word is the worst failure here, so both
// in-app navigation and a browser refresh ask first.
const savedForm = ref('')
const formSnapshot = () => JSON.stringify([form.value, thumbnail.value?.name ?? ''])
const isDirty = computed(() => savedForm.value !== '' && formSnapshot() !== savedForm.value)

onBeforeRouteLeave(() => {
  if (!isDirty.value) return true
  return window.confirm('Bỏ các thay đổi chưa lưu của game này?')
})

const warnUnload = (event: BeforeUnloadEvent) => {
  if (!isDirty.value) return
  event.preventDefault()
  event.returnValue = ''
}
onMounted(() => window.addEventListener('beforeunload', warnUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', warnUnload))

// Same rules the API enforces, checked here so a typo is caught before a round trip.
const localError = computed(() => {
  if (!form.value.title.trim()) return 'Cần nhập tên game.'
  if (!embedValid.value) {
    return embedTouched.value
      ? 'URL phải có dạng https://wordwall.net/embed/<mã game>.'
      : 'Cần nhập URL nhúng Wordwall.'
  }
  if (!form.value.game_type.trim()) return 'Cần nhập thể loại game.'
  if (skillsList.value.length > 8) return 'Tối đa 8 kỹ năng.'
  const min = form.value.age_min === '' ? null : Number(form.value.age_min)
  const max = form.value.age_max === '' ? null : Number(form.value.age_max)
  if (min !== null && (!Number.isInteger(min) || min < 0 || min > 18)) {
    return 'Tuổi nhỏ nhất phải là số nguyên từ 0 đến 18.'
  }
  if (max !== null && (!Number.isInteger(max) || max < 0 || max > 18)) {
    return 'Tuổi lớn nhất phải là số nguyên từ 0 đến 18.'
  }
  if (min !== null && max !== null && min > max) return 'Tuổi nhỏ nhất không được lớn hơn tuổi lớn nhất.'
  if (isPublished.value && !form.value.description.trim()) {
    return 'Game đang xuất bản phải có mô tả.'
  }
  return ''
})

const metadata = (): ActivityMetadata => ({
  title: form.value.title.trim(),
  description: form.value.description.trim(),
  embed_url: form.value.embed_url.trim(),
  game_type: form.value.game_type.trim(),
  topic: form.value.topic.trim(),
  skills: skillsList.value,
  age_min: form.value.age_min === '' ? null : Number(form.value.age_min),
  age_max: form.value.age_max === '' ? null : Number(form.value.age_max),
})

const pickThumbnail = (event: Event) => {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return

  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    formError.value = 'Ảnh bìa phải là PNG, JPG hoặc WebP.'
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    formError.value = 'Ảnh bìa tối đa 5 MB.'
    return
  }

  formError.value = ''
  thumbnail.value = file
  if (thumbnailPreview.value.startsWith('blob:')) URL.revokeObjectURL(thumbnailPreview.value)
  thumbnailPreview.value = URL.createObjectURL(file)
}

// Save, then upload the pending image, then apply the status the button asked for: the
// thumbnail endpoint needs an id, so it can only run after the metadata is stored.
const submit = async (action: 'save' | 'publish' | 'hide') => {
  pendingAction.value = null
  if (saving.value) return

  formError.value = localError.value
  formNote.value = ''
  if (localError.value) {
    // The reason to publish is worth naming even when a field is empty.
    if (action === 'publish') formError.value = 'Cần hoàn tất thông tin bắt buộc trước khi xuất bản.'
    return
  }

  saving.value = true
  // Snapshot what is actually being submitted: an edit made while the request is in
  // flight must stay dirty instead of being marked saved by a later form read.
  const submittedForm = { ...form.value }
  const submittedThumbnail = thumbnail.value
  const savedSnapshot = JSON.stringify([submittedForm, ''])
  try {
    const saved = isNew.value
      ? await createActivity(metadata())
      : await updateActivity(activityID.value, metadata())
    activity.value = saved

    // Leave /new before the follow-up calls: a retry after a failure must update this game
    // instead of creating a second one.
    if (isNew.value) {
      await router.replace(`/studio/games/${saved.id}`)
    }
    // Metadata is stored; a thumbnail that has not been accepted yet keeps the form dirty.
    savedForm.value = savedSnapshot

    let result = saved
    if (submittedThumbnail) {
      try {
        result = await uploadActivityThumbnail(saved.id, submittedThumbnail)
        // Only clear the file that was uploaded: a newer pick must survive.
        if (thumbnail.value === submittedThumbnail) {
          thumbnail.value = null
          savedForm.value = savedSnapshot
        }
      } catch (err) {
        // Metadata is already saved; keep the editor usable and say what failed.
        formError.value = `Đã lưu thông tin nhưng ảnh bìa lỗi: ${message(err)}`
      }
    }

    if (action !== 'save' && !formError.value) {
      const target = action === 'publish' ? 'published' : 'hidden'
      try {
        result = await setActivityStatus(saved.id, target)
      } catch (err) {
        // The metadata edit is already stored and may be public: name that state instead
        // of implying nothing happened.
        formError.value = `Đã lưu thông tin nhưng chưa đổi được trạng thái: ${message(err)}`
      }
    }

    activity.value = result
    if (!formError.value) {
      showToast(
        action === 'publish'
          ? 'Đã xuất bản game.'
          : action === 'hide'
            ? 'Đã ẩn game.'
            : 'Đã lưu game.',
      )
    }
  } catch (err) {
    formError.value = message(err)
  } finally {
    saving.value = false
  }
}

const preview = () => {
  if (!embedValid.value) return
  // Hold the validated URL: an edit while the preview is open must not retarget the src
  // or the "open on Wordwall" fallback at something the API would reject.
  previewSrc.value = form.value.embed_url.trim()
  previewOpen.value = true
  previewLoading.value = true
  previewFailed.value = false
  previewAttempt.value += 1

  window.clearTimeout(previewTimer)
  // The iframe can stay blank forever when Wordwall is blocked; give up and offer a link.
  previewTimer = window.setTimeout(() => {
    if (previewLoading.value) {
      previewLoading.value = false
      previewFailed.value = true
    }
  }, 10000)
}

const previewLoaded = () => {
  window.clearTimeout(previewTimer)
  previewLoading.value = false
  previewFailed.value = false
}
</script>

<template>
  <div class="game">
    <AppHeader />

    <div class="game__shell">
      <header class="game__header">
        <nav class="game__breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/studio">Teacher Studio</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink to="/studio/games">Quản lý game</RouterLink>
          <span aria-hidden="true">/</span>
          <span>{{ isNew ? 'Thêm game' : 'Sửa game' }}</span>
        </nav>
        <p class="game__eyebrow">
          <Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY
        </p>
        <h1 class="game__title">{{ isNew ? 'Thêm game Wordwall' : form.title || 'Sửa game' }}</h1>
        <p class="game__subtitle">
          <span v-if="!isNew" class="game__chip" :class="`game__chip--${status}`">
            {{ status === 'published' ? 'Đã xuất bản' : status === 'hidden' ? 'Đang ẩn' : 'Bản nháp' }}
          </span>
          Game tạo trên Wordwall, thông tin và ảnh bìa lưu ở đây.
        </p>
      </header>

      <p v-if="loading" class="game__state" role="status">Đang tải game…</p>

      <p v-else-if="loadError" class="game__state game__state--error" role="alert">
        {{ loadError }}
        <RouterLink class="game__link" to="/studio/games">Về danh sách game</RouterLink>
      </p>

      <div v-else class="game__layout">
        <form class="game__card" novalidate @submit.prevent="submit('save')">
          <label class="game__field">
            <span>Tên game *</span>
            <input
              v-model="form.title"
              type="text"
              maxlength="120"
              required
              :aria-invalid="!form.title.trim()"
            />
          </label>

          <label class="game__field">
            <span>URL nhúng Wordwall *</span>
            <input
              v-model="form.embed_url"
              type="url"
              placeholder="https://wordwall.net/embed/…"
              aria-describedby="embed-help"
              :aria-invalid="embedTouched && !embedValid"
              required
            />
          </label>
          <p
            id="embed-help"
            class="game__note"
            :class="{ 'game__note--error': embedTouched && !embedValid }"
          >
            <template v-if="embedTouched && !embedValid">
              Chỉ nhận link dạng https://wordwall.net/embed/&lt;mã game&gt;.
            </template>
            <template v-else>Mở game trên Wordwall → Share → Embed để lấy đúng link này.</template>
          </p>

          <div class="game__row">
            <label class="game__field">
              <span>Thể loại *</span>
              <input v-model="form.game_type" type="text" list="game-types" maxlength="60" required />
              <datalist id="game-types">
                <option v-for="type in gameTypeOptions" :key="type" :value="type" />
              </datalist>
            </label>
            <label class="game__field">
              <span>Chủ đề</span>
              <input v-model="form.topic" type="text" maxlength="80" />
            </label>
          </div>

          <div class="game__row game__row--ages">
            <label class="game__field">
              <span>Tuổi từ</span>
              <input v-model="form.age_min" type="number" min="0" max="18" inputmode="numeric" />
            </label>
            <label class="game__field">
              <span>Đến tuổi</span>
              <input v-model="form.age_max" type="number" min="0" max="18" inputmode="numeric" />
            </label>
          </div>

          <label class="game__field">
            <span>Kỹ năng</span>
            <input v-model="form.skills" type="text" placeholder="Nhận biết, Từ vựng" />
            <span class="game__note">Phân tách bằng dấu phẩy, tối đa 8 kỹ năng.</span>
          </label>

          <label class="game__field">
            <span>Mô tả ngắn</span>
            <textarea v-model="form.description" rows="4" maxlength="400" />
            <span class="game__note">{{ form.description.length }}/400 ký tự.</span>
          </label>

          <div class="game__field">
            <span>Ảnh bìa (PNG/JPG/WebP, gần 1.91:1)</span>
            <input
              ref="thumbnailInput"
              class="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Ảnh bìa game"
              @change="pickThumbnail"
            />
            <button type="button" class="game__secondary" @click="thumbnailInput?.click()">
              {{ thumbnail ? 'Chọn ảnh khác' : 'Chọn ảnh bìa' }}
            </button>
            <p v-if="thumbnail" class="game__note">✓ {{ thumbnail.name }} — lưu game để tải ảnh lên.</p>
          </div>

          <p v-if="formError" class="game__error" role="alert">{{ formError }}</p>
          <p v-else-if="formNote" class="game__success" role="status">{{ formNote }}</p>

          <div class="game__actions">
            <button type="submit" class="game__secondary" :disabled="saving">
              {{ saving ? 'Đang lưu…' : 'Lưu' }}
            </button>
            <button
              type="button"
              class="game__primary"
              :disabled="saving"
              @click="pendingAction = isPublished ? 'hide' : 'publish'"
            >
              {{ isPublished ? 'Ẩn game' : 'Xuất bản' }}
            </button>
            <RouterLink v-if="isPublished" class="game__link" :to="`/play/${activity?.slug}`">
              Xem trong Góc vui học
            </RouterLink>
          </div>

          <p class="game__note">
            Xuất bản là hiện ngay với phụ huynh, không cần duyệt. Bản nháp và game đang ẩn chỉ
            bạn thấy.
          </p>
        </form>

        <aside class="game__preview" aria-label="Xem trước">
          <h2 class="game__preview-title">Xem trước</h2>

          <article class="game__preview-card">
            <img
              v-if="thumbnailPreview"
              class="game__preview-art"
              :src="thumbnailPreview"
              alt="Ảnh bìa game"
            />
            <div v-else class="game__preview-art game__preview-art--empty" aria-hidden="true">🎲</div>
            <div class="game__preview-body">
              <p class="game__preview-name">{{ form.title || 'Tên game' }}</p>
              <p class="game__preview-meta">
                {{ form.game_type || 'Thể loại' }} · {{ ageLabel }}
              </p>
              <p class="game__preview-desc">
                {{ form.description || 'Mô tả ngắn của game sẽ hiện ở đây.' }}
              </p>
            </div>
          </article>

          <button
            type="button"
            class="game__secondary"
            :disabled="!embedValid"
            @click="preview"
          >
            Xem trước game
          </button>

          <div v-if="previewOpen" class="game__stage">
            <p v-if="previewLoading" class="game__note" role="status">Đang tải game…</p>
            <div v-if="previewFailed" class="game__state game__state--error" role="alert">
              Không tải được game.
              <button type="button" class="game__link" @click="preview">Thử lại</button>
              <a class="game__link" :href="previewSrc" target="_blank" rel="noopener">
                Mở trên Wordwall
              </a>
            </div>
            <iframe
              v-if="embedValid && !previewFailed"
              :key="previewAttempt"
              class="game__iframe"
              :src="previewSrc"
              title="Xem trước game Wordwall"
              allowfullscreen
              loading="lazy"
              referrerpolicy="no-referrer"
              @load="previewLoaded"
            />
          </div>
        </aside>
      </div>

      <ConfirmDialog
        :open="pendingAction !== null"
        :title="
          pendingAction === 'publish'
            ? 'Xuất bản game này?'
            : pendingAction === 'hide'
              ? 'Ẩn game này?'
              : 'Lưu thay đổi?'
        "
        :message="
          pendingAction === 'publish'
            ? 'Game sẽ hiện ngay trong Góc vui học cho phụ huynh và các bé.'
            : pendingAction === 'hide'
              ? 'Game sẽ biến khỏi Góc vui học cho tới khi bạn xuất bản lại.'
              : 'Thông tin và ảnh bìa mới sẽ được lưu.'
        "
        :confirm-label="
          pendingAction === 'publish' ? 'Xuất bản' : pendingAction === 'hide' ? 'Ẩn game' : 'Lưu'
        "
        @confirm="submit(pendingAction === 'hide' ? 'hide' : pendingAction === 'publish' ? 'publish' : 'save')"
        @cancel="pendingAction = null"
      />
      <AppToast :message="toast" />
    </div>
  </div>
</template>

<style scoped>
.game {
  min-height: 100vh;
  background: #fff8ec;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.game__shell {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 24px 56px;
}

.game__header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.game__breadcrumb {
  display: flex;
  gap: 8px;
  color: #77847c;
  font-size: 14px;
}

.game__breadcrumb a:hover {
  color: #397653;
}

.game__eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.78px;
}

.game__title {
  margin: 0;
  color: #2e4a38;
  font-size: 36px;
  font-weight: 700;
  line-height: 1.14;
}

.game__subtitle {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  margin: 0;
  color: #66756c;
}

.game__chip {
  border-radius: 999px;
  padding: 4px 10px;
  font-size: 12px;
  font-weight: 700;
}

.game__chip--published {
  background: #e7f6ec;
  color: #2f6f4c;
}

.game__chip--draft {
  background: #fdf3d8;
  color: #8a6a12;
}

.game__chip--hidden {
  background: #f1ece1;
  color: #77847c;
}

.game__layout {
  display: grid;
  grid-template-columns: minmax(0, 1.35fr) minmax(0, 1fr);
  gap: 24px;
  margin-top: 24px;
  align-items: start;
}

@media (max-width: 900px) {
  .game__layout {
    grid-template-columns: 1fr;
  }
}

.game__card,
.game__preview {
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-radius: 20px;
  background: #fff;
  padding: 24px;
}

.game__field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #2e4a38;
}

.game__field input,
.game__field textarea {
  border: 1px solid #e3ded2;
  border-radius: 12px;
  padding: 11px 14px;
  color: #34423b;
  font: inherit;
  font-weight: 400;
}

.game__row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.game__row--ages {
  grid-template-columns: repeat(2, minmax(0, 120px));
}

.game__note {
  margin: 0;
  color: #8a968f;
  font-size: 13px;
  font-weight: 400;
}

.game__note--error {
  color: #b4462f;
}

.game__error {
  margin: 0;
  color: #b4462f;
  font-size: 14px;
}

.game__success {
  margin: 0;
  color: #2f6f4c;
  font-size: 14px;
}

.game__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.game__primary {
  border: 0;
  border-radius: 999px;
  padding: 12px 20px;
  background: #397653;
  color: #fff;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.game__secondary {
  border: 1px solid #cfe3d6;
  border-radius: 999px;
  padding: 11px 18px;
  background: #fff;
  color: #397653;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.game__link {
  border: 0;
  background: none;
  padding: 0;
  color: #397653;
  font: inherit;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.game__state {
  margin-top: 20px;
  color: #66756c;
}

.game__state--error {
  color: #b4462f;
}

.game__preview-title {
  margin: 0;
  color: #2e4a38;
  font-size: 18px;
}

.game__preview-card {
  overflow: hidden;
  border: 1px solid #f1ece1;
  border-radius: 16px;
}

.game__preview-art {
  width: 100%;
  aspect-ratio: 1.91 / 1;
  object-fit: cover;
  background: #f1ece1;
}

.game__preview-art--empty {
  display: grid;
  place-items: center;
  font-size: 40px;
}

.game__preview-body {
  padding: 14px 16px;
}

.game__preview-name {
  margin: 0;
  color: #2e4a38;
  font-weight: 700;
}

.game__preview-meta {
  margin: 4px 0 0;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
}

.game__preview-desc {
  margin: 8px 0 0;
  color: #66756c;
  font-size: 14px;
}

.game__stage {
  border-radius: 16px;
  overflow: hidden;
  background: #f4f7f2;
  padding: 12px;
}

.game__iframe {
  width: 100%;
  aspect-ratio: 16 / 10;
  border: 0;
  border-radius: 12px;
  background: #fff;
}
</style>
