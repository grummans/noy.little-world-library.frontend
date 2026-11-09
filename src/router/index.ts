import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import LibraryView from '../views/LibraryView.vue'
import BookDetailView from '../views/BookDetailView.vue'
import ReaderView from '../views/ReaderView.vue'
import AboutView from '../views/AboutView.vue'
import LoginView from '../views/LoginView.vue'
import ParentLibraryView from '../views/ParentLibraryView.vue'
import TeacherStudioView from '../views/TeacherStudioView.vue'
import StudioBookEditView from '../views/StudioBookEditView.vue'
import StudioBundlesView from '../views/StudioBundlesView.vue'
import StudioGamesView from '../views/StudioGamesView.vue'
import StudioGameEditView from '../views/StudioGameEditView.vue'
import BundleDetailView from '../views/BundleDetailView.vue'
import CheckoutView from '../views/CheckoutView.vue'
import OrdersView from '../views/OrdersView.vue'
import PaymentReturnView from '../views/PaymentReturnView.vue'
import PlayView from '../views/PlayView.vue'
import PlayActivityView from '../views/PlayActivityView.vue'
import { useSession } from '../composables/useSession'

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior: () => ({ top: 0 }),
  routes: [
    { path: '/', component: HomeView },
    { path: '/library', component: LibraryView },
    { path: '/books/:slug', component: BookDetailView },
    { path: '/read/:slug', component: ReaderView },
    { path: '/about', component: AboutView },
    { path: '/login', component: LoginView },
    {
      path: '/checkout',
      component: CheckoutView,
      meta: { role: 'parent' },
    },
    { path: '/payment/return', component: PaymentReturnView },
    { path: '/orders', component: OrdersView, meta: { role: 'parent' } },
    {
      path: '/parent/library',
      component: ParentLibraryView,
      meta: { role: 'parent' },
    },
    { path: '/bundles/:slug', component: BundleDetailView },
    {
      path: '/studio',
      component: TeacherStudioView,
      meta: { role: 'teacher' },
    },
    { path: '/studio/upload', redirect: '/studio' },
    {
      path: '/studio/books/:id',
      component: StudioBookEditView,
      meta: { role: 'teacher' },
    },
    {
      path: '/studio/bundles',
      component: StudioBundlesView,
      meta: { role: 'teacher' },
    },
    {
      path: '/studio/games',
      component: StudioGamesView,
      meta: { role: 'teacher' },
    },
    {
      // 'new' is a route rather than a modal: the editor needs a full form and a preview.
      path: '/studio/games/:id',
      component: StudioGameEditView,
      meta: { role: 'teacher' },
    },
    { path: '/play', component: PlayView },
    { path: '/play/:slug', component: PlayActivityView },
    { path: '/admin', redirect: '/studio' },
  ],
})

// Signed-out visitors are sent to the login page (and land on the homepage once they sign
// in). A user with the wrong role is sent to their own home instead of a broken screen.
//
// The session is re-checked on every guarded navigation (force): a cookie can expire or
// change in another tab, and a cached user would otherwise pass this guard forever.
router.beforeEach(async (to) => {
  const requiredRole = to.meta.role
  if (!requiredRole) return true

  const { user, status } = await useSession().check(true)

  if (status === 'error') {
    // The API could not answer. Do not pretend the visitor is signed out; let the screen
    // show its own error and retry.
    return true
  }
  if (!user) {
    // replace: the bounced URL must not come back as a Back-button trap behind the login page.
    return { path: '/login', replace: true }
  }
  if (user.role !== requiredRole) {
    // Wrong screen for this role: send them to the one their role lives on, not the marketing
    // homepage a sign-in lands on.
    return { path: user.role === 'teacher' ? '/studio' : '/parent/library' }
  }
  return true
})

export default router
