// One shared session state: the header, the login page and guarded routes all read the
// same user. The cookie is HttpOnly, so "signed in" is decided by /api/auth/me.

import { readonly, ref } from 'vue'
import { ApiError } from '../api/client'
import {
  currentUser,
  login as loginRequest,
  logout as logoutRequest,
  register as registerRequest,
  type Role,
  type SessionUser,
} from '../api/auth'

/** What the last check told us. "error" means the server could not answer. */
export type SessionStatus = 'ok' | 'anonymous' | 'error'

const user = ref<SessionUser | null>(null)
const loading = ref(false)
// Bumped by every auth action, so a slow /me response cannot overwrite a newer login.
let generation = 0
let loaded = false
// The in-flight /me, so components mounting together share one request instead of firing two.
let pending: Promise<{ user: SessionUser | null; status: SessionStatus }> | null = null

export function useSession() {
  /**
   * Reads the session. Resolves the user plus a status the router can act on: a network
   * failure must not look like "signed out", or a valid session would be bounced to login.
   */
  const check = (force = false): Promise<{ user: SessionUser | null; status: SessionStatus }> => {
    if (loaded && !force) {
      return Promise.resolve({ user: user.value, status: user.value ? 'ok' : 'anonymous' })
    }

    // On first paint the header and the page both ask for the session; the second caller
    // joins the request already in flight rather than duplicating it.
    pending ??= request().finally(() => {
      pending = null
    })
    return pending
  }

  const request = async (): Promise<{ user: SessionUser | null; status: SessionStatus }> => {
    const mine = ++generation
    loading.value = true
    try {
      const current = await currentUser()
      if (mine !== generation) return { user: user.value, status: user.value ? 'ok' : 'anonymous' }

      user.value = current
      loaded = true
      return { user: current, status: 'ok' }
    } catch (err) {
      if (mine !== generation) return { user: user.value, status: user.value ? 'ok' : 'anonymous' }

      if (err instanceof ApiError && err.status === 401) {
        user.value = null
        loaded = true
        return { user: null, status: 'anonymous' }
      }

      // Network or server problem: keep whatever we knew and let the caller decide.
      console.warn('Không kiểm tra được phiên đăng nhập', err)
      return { user: user.value, status: 'error' }
    } finally {
      if (mine === generation) loading.value = false
    }
  }

  const load = async (force = false) => (await check(force)).user

  const adopt = (current: SessionUser) => {
    generation++
    user.value = current
    loaded = true
    return current
  }

  const login = async (email: string, password: string, role: Role) =>
    adopt(await loginRequest(email, password, role))

  const register = async (displayName: string, email: string, password: string, role: Role) =>
    adopt(await registerRequest(displayName, email, password, role))

  const logout = async () => {
    await logoutRequest()
    generation++
    user.value = null
    loaded = true
  }

  return {
    user: readonly(user),
    loading: readonly(loading),
    check,
    load,
    login,
    register,
    logout,
  }
}

/** Where a signed-in user lands: the public homepage, or the studio for a teacher. */
export function homeFor(user: SessionUser): string {
  return user.role === 'teacher' ? '/studio/dashboard' : '/'
}
