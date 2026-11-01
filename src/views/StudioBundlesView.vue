<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { ApiError } from '../api/client'
import {
  listMyBundles,
  publishBundle,
  unpublishBundle,
  type TeacherBundle,
} from '../api/teacher'
import BundleModal from '../components/studio/BundleModal.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import { useToast } from '../composables/useToast'

const bundles = ref<TeacherBundle[]>([])
const loading = ref(true)
const error = ref('')
const busyId = ref<number | null>(null)
const actionError = ref('')
const pendingToggle = ref<TeacherBundle | null>(null)
const editing = ref<TeacherBundle | null>(null)
const creating = ref(false)
const { message: toast, show: showToast } = useToast()

const load = async () => {
  loading.value = true
  error.value = ''
  try {
    bundles.value = await listMyBundles()
  } catch (err) {
    error.value = message(err)
  } finally {
    loading.value = false
  }
}

onMounted(load)

const message = (err: unknown): string => {
  if (!(err instanceof ApiError)) return 'Không tải được danh sách gói sách.'
  if (err.status === 401 || err.status === 403) {
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  }
  if (err.code === 'network') return 'Mất kết nối máy chủ. Kiểm tra mạng rồi thử lại.'
  return 'Không tải được danh sách gói sách.'
}

const toggleMessage = computed(() => {
  const bundle = pendingToggle.value
  if (!bundle) return ''
  return bundle.status === 'published'
    ? `“${bundle.title}” sẽ không còn bán cho tới khi bạn xuất bản lại. Người đã mua vẫn đọc được.`
    : `“${bundle.title}” sẽ được bán trong thư viện với ${bundle.book_ids.length} sách, giá ${bundle.price_vnd.toLocaleString('vi-VN')}đ.`
})

const askToggle = (bundle: TeacherBundle) => {
  if (busyId.value !== null) return
  pendingToggle.value = bundle
}

const confirmToggle = async () => {
  const bundle = pendingToggle.value
  pendingToggle.value = null
  if (!bundle || busyId.value !== null) return

  const publishing = bundle.status !== 'published'
  busyId.value = bundle.id
  actionError.value = ''
  try {
    const updated = publishing
      ? await publishBundle(bundle.id)
      : await unpublishBundle(bundle.id)
    bundles.value = bundles.value.map((item) => (item.id === updated.id ? updated : item))
    showToast(publishing ? 'Đã xuất bản gói sách.' : 'Đã hủy xuất bản gói sách.')
  } catch (err) {
    actionError.value =
      err instanceof ApiError && err.code === 'not_publishable'
        ? 'Gói cần ít nhất một sách đã xuất bản trước khi xuất bản.'
        : err instanceof ApiError && err.code === 'validation'
          ? 'Không thể hủy xuất bản vì gói đang được bán.'
          : message(err)
  } finally {
    busyId.value = null
  }
}

const onSaved = (updated: TeacherBundle) => {
  const exists = bundles.value.some((item) => item.id === updated.id)
  bundles.value = exists
    ? bundles.value.map((item) => (item.id === updated.id ? updated : item))
    : [updated, ...bundles.value]
  editing.value = null
  creating.value = false
}

const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`
</script>

<template>
  <div class="bundles">
    <div class="bundles__shell">
      <header class="bundles__top">
        <RouterLink class="bundles__back" to="/studio">← Sách của tôi</RouterLink>
        <p class="bundles__brand">Little Wonder / Teacher Studio</p>
      </header>

      <section class="bundles__head">
        <div>
          <h1>Gói sách</h1>
          <p class="bundles__subtitle">
            Gom các sách đã xuất bản thành một gói trả phí. Người mua đọc được toàn bộ sách trong gói.
          </p>
        </div>
        <button type="button" class="bundles__primary" @click="creating = true">
          ＋ Tạo gói sách
        </button>
      </section>

      <p v-if="actionError" class="bundles__state bundles__state--error" role="alert">
        {{ actionError }}
      </p>

      <p v-if="loading" class="bundles__state" role="status">Đang tải gói sách…</p>

      <p v-else-if="error" class="bundles__state bundles__state--error" role="alert">
        {{ error }}
        <button type="button" class="bundles__action" @click="load">Thử lại</button>
      </p>

      <div v-else-if="!bundles.length" class="bundles__state">
        <h2>Chưa có gói sách nào</h2>
        <p>Tạo gói đầu tiên từ các sách bạn đã xuất bản.</p>
        <button type="button" class="bundles__primary" @click="creating = true">
          ＋ Tạo gói sách
        </button>
      </div>

      <div v-else class="bundles__table-wrap">
        <table class="bundles__table">
          <caption class="sr-only">Danh sách gói sách của bạn</caption>
          <thead>
            <tr>
              <th scope="col">GÓI SÁCH</th>
              <th scope="col">SỐ SÁCH</th>
              <th scope="col">GIÁ</th>
              <th scope="col">TRẠNG THÁI</th>
              <th scope="col">THAO TÁC</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="bundle in bundles" :key="bundle.id">
              <td>
                <p class="bundles__title">{{ bundle.title }}</p>
                <p class="bundles__slug">{{ bundle.slug }}</p>
              </td>
              <td class="bundles__cell">{{ bundle.book_ids.length }}</td>
              <td class="bundles__cell">{{ money(bundle.price_vnd) }}</td>
              <td>
                <span
                  class="bundles__chip"
                  :class="
                    bundle.status === 'published' ? 'bundles__chip--published' : 'bundles__chip--draft'
                  "
                >
                  {{ bundle.status === 'published' ? 'Đã xuất bản' : 'Bản nháp' }}
                </span>
              </td>
              <td>
                <span class="bundles__actions">
                  <button
                    type="button"
                    class="bundles__action"
                    :aria-label="`Sửa ${bundle.title}`"
                    @click="editing = bundle"
                  >
                    Sửa
                  </button>
                  <button
                    type="button"
                    class="bundles__action"
                    :disabled="busyId !== null"
                    :aria-label="`${bundle.status === 'published' ? 'Hủy xuất bản' : 'Xuất bản'} ${bundle.title}`"
                    @click="askToggle(bundle)"
                  >
                    {{
                      busyId === bundle.id
                        ? '…'
                        : bundle.status === 'published'
                          ? 'Hủy xuất bản'
                          : 'Xuất bản'
                    }}
                  </button>
                  <RouterLink
                    v-if="bundle.status === 'published'"
                    class="bundles__action"
                    :to="`/bundles/${bundle.slug}`"
                  >
                    Xem
                  </RouterLink>
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <ConfirmDialog
      :open="Boolean(pendingToggle)"
      :title="pendingToggle?.status === 'published' ? 'Hủy xuất bản gói này?' : 'Xuất bản gói này?'"
      :message="toggleMessage"
      :confirm-label="pendingToggle?.status === 'published' ? 'Hủy xuất bản' : 'Xuất bản'"
      @confirm="confirmToggle"
      @cancel="pendingToggle = null"
    />

    <BundleModal
      :open="creating"
      :bundle="null"
      @close="creating = false"
      @saved="onSaved"
    />
    <BundleModal
      :open="Boolean(editing)"
      :bundle="editing"
      @close="editing = null"
      @saved="onSaved"
    />

    <AppToast :message="toast" />
  </div>
</template>

<style scoped>
.bundles {
  min-height: 100vh;
  background: #fff8ec;
  font-family: "Nunito", system-ui, sans-serif;
  color: #34423b;
}

.bundles__shell {
  max-width: 1150px;
  margin: 0 auto;
  padding: 24px 24px 48px;
}

.bundles__top {
  display: flex;
  align-items: baseline;
  gap: 16px;
  flex-wrap: wrap;
  background: #fff;
  border-radius: 18px;
  padding: 18px;
}

.bundles__brand {
  margin: 0;
  color: #397653;
  font-weight: 700;
  font-size: 21px;
}

.bundles__back {
  color: #397653;
  font-size: 14px;
  font-weight: 700;
  text-decoration: none;
}

.bundles__head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin: 24px 0 16px;
}

.bundles__head h1 {
  margin: 0;
  font-size: 30px;
}

.bundles__subtitle {
  margin: 6px 0 0;
  color: #77847c;
  font-size: 14px;
  max-width: 640px;
}

.bundles__table-wrap {
  background: #fff;
  border-radius: 20px;
  padding: 8px 4px;
  overflow-x: auto;
}

.bundles__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.bundles__table th {
  text-align: left;
  padding: 12px 16px;
  color: #77847c;
  font-size: 12px;
  letter-spacing: 0.04em;
}

.bundles__table td {
  padding: 14px 16px;
  border-top: 1px solid #eef3ec;
  vertical-align: top;
}

.bundles__title {
  margin: 0;
  font-weight: 700;
}

.bundles__slug {
  margin: 2px 0 0;
  color: #77847c;
  font-size: 12px;
}

.bundles__cell {
  color: #34423b;
  white-space: nowrap;
}

.bundles__chip {
  display: inline-block;
  border-radius: 999px;
  padding: 4px 12px;
  font-size: 12px;
  font-weight: 700;
}

.bundles__chip--published {
  background: #d9f1e1;
  color: #397653;
}

.bundles__chip--draft {
  background: #ffe8b0;
  color: #6b4b12;
}

.bundles__actions {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.bundles__action {
  border: 0;
  background: none;
  padding: 0;
  color: #397653;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  text-decoration: underline;
  cursor: pointer;
}

.bundles__primary {
  border: 0;
  cursor: pointer;
  font-family: inherit;
  background: #397653;
  color: #fff;
  border-radius: 15px;
  padding: 12px 22px;
  font-size: 15px;
  font-weight: 700;
}

.bundles__state {
  background: #fff;
  border-radius: 18px;
  padding: 20px;
  font-size: 15px;
}

.bundles__state h2 {
  margin: 0 0 6px;
  font-size: 20px;
}

.bundles__state p {
  margin: 0 0 12px;
  color: #77847c;
}

.bundles__state--error {
  color: #b3261e;
}
</style>
