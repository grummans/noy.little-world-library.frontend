// Session endpoints. The cookie is HttpOnly, so the client only ever sees the user.

import { apiFetch, postJSON } from './client'

export type Role = 'parent' | 'teacher'

export interface SessionUser {
  id: number
  email: string
  display_name: string
  role: Role
}

export const login = (email: string, password: string) =>
  postJSON<SessionUser>('/api/auth/login', { email, password })

export const register = (displayName: string, email: string, password: string, role: Role) =>
  postJSON<SessionUser>('/api/auth/register', {
    display_name: displayName,
    email,
    password,
    role,
  })


export const logout = () => apiFetch<void>('/api/auth/logout', { method: 'POST' })

export const currentUser = () => apiFetch<SessionUser>('/api/auth/me')
