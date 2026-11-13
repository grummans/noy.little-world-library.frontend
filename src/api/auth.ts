// Session endpoints. The cookie is HttpOnly, so the client only ever sees the user.

import { apiFetch, postJSON } from './client'

export type Role = 'parent' | 'teacher'

export interface SessionUser {
  id: number
  email: string
  display_name: string
  role: Role
}

// The sign-in tab is part of the credentials: an account whose role does not match the chosen
// tab is refused, and the API answers with the same invalid-credentials error it uses for a
// wrong password, so a guess can never reveal which site an email belongs to.
export const login = (email: string, password: string, role: Role) =>
  postJSON<SessionUser>('/api/auth/login', { email, password, role })

export const register = (displayName: string, email: string, password: string, role: Role) =>
  postJSON<SessionUser>('/api/auth/register', {
    display_name: displayName,
    email,
    password,
    role,
  })


export const logout = () => apiFetch<void>('/api/auth/logout', { method: 'POST' })

export const currentUser = () => apiFetch<SessionUser>('/api/auth/me')
