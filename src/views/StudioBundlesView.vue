<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import { ApiError } from '../api/client'
import {
  getSales,
  listMyBundles,
  publishBundle,
  unpublishBundle,
  type SalesItem,
  type TeacherBundle,
} from '../api/teacher'
import AppHeader from '../components/app/AppHeader.vue'
import BundleModal from '../components/studio/BundleModal.vue'
import ConfirmDialog from '../components/app/ConfirmDialog.vue'
import AppToast from '../components/app/AppToast.vue'
import { useToast } from '../composables/useToast'

const bundles = ref<TeacherBundle[]>([])
// Paid orders only; a bundle never splits its revenue onto the books inside it.
const sales = ref<SalesItem[]>([])
const salesError = ref('')
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
  salesError.value = ''
  try {
    const [bundleList, salesResult] = await Promise.allSettled([listMyBundles(), getSales()])
    if (bundleList.status === 'fulfilled') {
      bundles.value = bundleList.value
    } else {
      error.value = message(bundleList.reason)
    }
    if (salesResult.status === 'fulfilled') {
      sales.value = salesResult.value.bundles
    } else {
      // Zero sales and a broken report look identical, so say it out loud.
      salesError.value = 'Không tải được số liệu bán hàng, các cột Đã bán và Doanh thu có thể trống.'
    }
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

const noSale: SalesItem = { id: 0, sold: 0, revenue_vnd: 0 }
const salesByBundle = computed(() => {
  const map = new Map<number, SalesItem>()
  for (const item of sales.value) map.set(item.id, item)
  return map
})
const salesFor = (bundleID: number) => salesByBundle.value.get(bundleID) ?? noSale
</script>

<template>
  <div class="bundles">
    <AppHeader />
    <div class="bundles__shell">
      <header class="bundles__top">
        <nav class="bundles__breadcrumb" aria-label="Breadcrumb">
          <RouterLink to="/">Trang chủ</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink to="/studio">Teacher Studio</RouterLink>
          <span aria-hidden="true">/</span>
          <span>Gói sách</span>
        </nav>
        <p class="bundles__eyebrow">
          <Sparkles :size="14" aria-hidden="true" /> LITTLE WONDER LIBRARY
        </p>
        <h1 class="bundles__page-title">Gói sách</h1>
        <p class="bundles__subtitle">
          Gom các sách đã xuất bản thành một gói trả phí. Người mua đọc được toàn bộ sách trong gói.
        </p>
      </header>

      <div class="bundles__head">
        <button type="button" class="bundles__primary" @click="creating = true">
          ＋ Tạo gói sách
        </button>
      </div>

      <p v-if="actionError" class="bundles__state bundles__state--error" role="alert">
        {{ actionError }}
      </p>

      <p v-if="salesError" class="bundles__state bundles__state--warning" role="alert">
        {{ salesError }}
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
              <th scope="col">ĐÃ BÁN</th>
              <th scope="col">DOANH THU</th>
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
              <td class="bundles__cell">{{ salesFor(bundle.id).sold }}</td>
              <td class="bundles__cell">{{ money(salesFor(bundle.id).revenue_vnd) }}</td>
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

/* Same block shape and type scale as the About page header: breadcrumb, brand eyebrow,
   page title, then one line of muted context — no card wrapping it. */
.bundles__top {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.bundles__breadcrumb {
  display: flex;
  gap: 16px;
  color: #77847c;
  font-size: 14px;
}

.bundles__breadcrumb a:hover {
  color: #397653;
}

.bundles__eyebrow {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 0;
  color: #397653;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.78px;
}

.bundles__page-title {
  margin: 0;
  color: #2e4a38;
  font-size: 40px;
  font-weight: 700;
  line-height: 1.12;
}

.bundles__head {
  display: flex;
  justify-content: flex-end;
  margin: 20px 0 16px;
}

.bundles__subtitle {
  margin: 0;
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
  padding: 5px 12px 3px;
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

.bundles__state--warning {
  color: #8a6d1f;
}
</style>
