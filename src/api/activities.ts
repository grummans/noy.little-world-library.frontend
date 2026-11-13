// Public + teacher calls for Góc vui học. The game itself lives on Wordwall; this API
// only carries metadata, the verified embed URL and the thumbnail URL.

import { apiFetch, postJSON, putJSON } from './client'

export type ActivityStatus = 'draft' | 'hidden' | 'published'

export interface Activity {
  id: number
  slug: string
  title: string
  description: string
  embed_url: string
  game_type: string
  topic: string
  skills: string[]
  age_min: number | null
  age_max: number | null
  thumbnail_url: string
  status: ActivityStatus
  published_at: string | null
  updated_at: string
}

export interface ActivityPage {
  items: Activity[]
  /** Filtered row count, so the page can print "1-10 trong 24 trò chơi". */
  total: number
  has_more: boolean
}

export interface ActivityFacets {
  game_types: string[]
  skills: string[]
  /** Topics of published games; the library's category chips. */
  topics: string[]
}

export interface ActivityQuery {
  q?: string
  game_type?: string
  skill?: string
  topic?: string
  age?: number | null
  page?: number
  limit?: number
}

export const listActivities = (query: ActivityQuery = {}) => {
  const params = new URLSearchParams()
  if (query.q) params.set('q', query.q)
  if (query.game_type) params.set('game_type', query.game_type)
  if (query.skill) params.set('skill', query.skill)
  if (query.topic) params.set('topic', query.topic)
  if (query.age != null) params.set('age', String(query.age))
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))

  const search = params.toString()
  return apiFetch<ActivityPage>(`/api/activities${search ? `?${search}` : ''}`)
}

export const getActivity = (slug: string) =>
  apiFetch<Activity>(`/api/activities/${encodeURIComponent(slug)}`)

export const getActivityFacets = () => apiFetch<ActivityFacets>('/api/activities/facets')

/** "3–5 tuổi" or "Từ 6 tuổi" — the card and the detail page show the same label. */
export const activityAgeLabel = (activity: Activity) => {
  const { age_min: min, age_max: max } = activity
  if (min != null && max != null) return `${min}–${max} tuổi`
  if (min != null) return `Từ ${min} tuổi`
  if (max != null) return `Đến ${max} tuổi`
  return 'Mọi độ tuổi'
}

// ---- Teacher (Teacher Studio) -------------------------------------------------------
// Every call is scoped to the signed-in teacher by the session cookie; the API answers
// 404 for someone else's game, so the list can never show a foreign row.

export interface ActivityStats {
  total: number
  published: number
  draft: number
  hidden: number
}

export interface TeacherActivityList {
  items: Activity[]
  stats: ActivityStats
}

export interface ActivityMetadata {
  slug?: string
  title: string
  description: string
  embed_url: string
  game_type: string
  topic: string
  skills: string[]
  age_min: number | null
  age_max: number | null
}

export const listMyActivities = () =>
  apiFetch<TeacherActivityList>('/api/teacher/activities')

export const getMyActivity = (id: number) =>
  apiFetch<Activity>(`/api/teacher/activities/${id}`)

export const createActivity = (metadata: ActivityMetadata) =>
  postJSON<Activity>('/api/teacher/activities', metadata)

export const updateActivity = (id: number, metadata: ActivityMetadata) =>
  putJSON<Activity>(`/api/teacher/activities/${id}`, metadata)

export const setActivityStatus = (id: number, status: ActivityStatus) =>
  putJSON<Activity>(`/api/teacher/activities/${id}/status`, { status })

// The browser sets the multipart boundary itself, so the body is a FormData as-is.
export const uploadActivityThumbnail = (id: number, file: File) => {
  const form = new FormData()
  form.set('thumbnail', file)
  return apiFetch<Activity>(`/api/teacher/activities/${id}/thumbnail`, {
    method: 'PUT',
    body: form,
  })
}

/** Wordwall's share snippet points at the localized page (`/vi/embed/…`) and carries a whole
 *  `<iframe …>` tag; rebuild just the parts the API accepts so a teacher can paste anything.
 *  Query params are left alone on purpose: the API is the only place that decides which ones it
 *  keeps, so one rule set cannot drift from the other. */
export const normalizeWordwallInput = (raw: string) => {
  const src = /<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i.exec(raw)?.[1] ?? raw
  let url: URL
  try {
    url = new URL(src.trim())
  } catch {
    return raw.trim()
  }
  const embed = /^\/(?:[A-Za-z]{2,5}(?:[-_][A-Za-z]{2,5})?\/)?embed\/([A-Za-z0-9_-]{8,64})\/?$/.exec(url.pathname)
  if (url.protocol !== 'https:' || url.host !== 'wordwall.net' || !embed) return src.trim()
  const search = url.searchParams.toString()
  return `https://wordwall.net/embed/${embed[1]}${search ? `?${search}` : ''}`
}

export const isWordwallEmbedURL = (value: string) => {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.host !== 'wordwall.net') return false
  if (url.username || url.password || url.hash || url.port) return false
  return /^\/embed\/[A-Za-z0-9_-]{8,64}$/.test(url.pathname)
}
