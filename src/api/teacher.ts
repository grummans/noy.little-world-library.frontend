// Teacher Studio endpoints: a teacher only ever sees and edits their own books.

import { apiFetch, postJSON, putJSON } from './client'
import type { Tag } from './catalog'

export type BookStatus = 'draft' | 'published'
export type AccessType = 'free' | 'paid'

export interface TeacherBook {
  id: number
  slug: string
  title: string
  description: string
  access_type: AccessType
  price_vnd: number | null
  age_min: number | null
  age_max: number | null
  status: BookStatus
  page_count: number | null
  has_audio: boolean
  has_video: boolean
  tag_ids: number[]
  has_epub: boolean
  has_cover: boolean
  published_at: string | null
  updated_at: string
}

export const listMyBooks = () => apiFetch<TeacherBook[]>('/api/teacher/books')

export const getMyBook = (id: number) => apiFetch<TeacherBook>(`/api/teacher/books/${id}`)

export const publishBook = (id: number) =>
  postJSON<TeacherBook>(`/api/teacher/books/${id}/publish`, {})

export const unpublishBook = (id: number) =>
  postJSON<TeacherBook>(`/api/teacher/books/${id}/unpublish`, {})

export interface BookMetadata {
  slug?: string
  title: string
  description: string
  access_type: AccessType
  price_vnd?: number | null
  age_min?: number | null
  age_max?: number | null
  tag_id: number | null
}

export const updateBook = (id: number, metadata: BookMetadata) =>
  putJSON<TeacherBook>(`/api/teacher/books/${id}`, metadata)

export const listTopics = () => apiFetch<Tag[]>('/api/tags')

export interface NewBookInput {
  title: string
  description: string
  accessType: AccessType
  priceVND?: number | null
  ageMin?: number | null
  ageMax?: number | null
  tagId?: number | null
  epub: File
  cover: File | null
}

// Browsers label .epub as application/octet-stream (or nothing) and some PNGs as
// application/octet-stream too; the API validates the declared type, so name it here
// instead of trusting the OS file association.
const withType = (file: File, type: string) =>
  file.type === type ? file : new File([file], file.name, { type })


// The browser sets the multipart boundary itself, so the body is a FormData as-is.
export const createBook = (input: NewBookInput) => {
  const form = new FormData()
  form.set('title', input.title)
  form.set('description', input.description)
  form.set('access_type', input.accessType)
  if (input.priceVND) form.set('price_vnd', String(input.priceVND))
  if (input.ageMin !== null && input.ageMin !== undefined) form.set('age_min', String(input.ageMin))
  if (input.ageMax !== null && input.ageMax !== undefined) form.set('age_max', String(input.ageMax))
  if (input.tagId) form.set('tag_id', String(input.tagId))

  form.set('epub', withType(input.epub, 'application/epub+zip'))
  if (input.cover) {
    const type = input.cover.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    form.set('cover', withType(input.cover, type))
  }

  return apiFetch<TeacherBook>('/api/teacher/books', { method: 'POST', body: form })
}

export const createTopic = (name: string) =>
  postJSON<Tag>('/api/teacher/tags', { name })

// Replacing files uses the same multipart shape as creation; either field may be omitted.
export const replaceBookFiles = (id: number, files: { epub?: File | null; cover?: File | null }) => {
  const form = new FormData()
  if (files.epub) form.set('epub', withType(files.epub, 'application/epub+zip'))
  if (files.cover) {
    const type = files.cover.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    form.set('cover', withType(files.cover, type))
  }
  return apiFetch<TeacherBook>(`/api/teacher/books/${id}/files`, { method: 'PUT', body: form })
}

export interface TeacherBundle {
  id: number
  slug: string
  title: string
  description: string
  price_vnd: number
  status: BookStatus
  book_ids: number[]
  tag_ids: number[]
  has_cover: boolean
  published_at: string | null
  updated_at: string
}

export interface BundleInput {
  title: string
  description: string
  priceVND: number
  bookIds: number[]
  cover?: File | null
}

export const listMyBundles = () => apiFetch<TeacherBundle[]>('/api/teacher/bundles')

export const getMyBundle = (id: number) => apiFetch<TeacherBundle>(`/api/teacher/bundles/${id}`)

export const publishBundle = (id: number) =>
  postJSON<TeacherBundle>(`/api/teacher/bundles/${id}/publish`, {})

export const unpublishBundle = (id: number) =>
  postJSON<TeacherBundle>(`/api/teacher/bundles/${id}/unpublish`, {})

// Bundles are edited through multipart because the same endpoint accepts a cover image.
const bundleForm = (input: BundleInput) => {
  const form = new FormData()
  form.set('title', input.title)
  form.set('description', input.description)
  form.set('price_vnd', String(input.priceVND))
  for (const id of input.bookIds) form.append('book_ids', String(id))
  if (input.cover) {
    const type = input.cover.name.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    form.set('cover', withType(input.cover, type))
  }
  return form
}

export const createBundle = (input: BundleInput) =>
  apiFetch<TeacherBundle>('/api/teacher/bundles', { method: 'POST', body: bundleForm(input) })

// Covers are replaced separately so a metadata edit cannot drop the existing image.
export const updateBundle = (id: number, input: BundleInput) =>
  apiFetch<TeacherBundle>(`/api/teacher/bundles/${id}`, {
    method: 'PUT',
    body: bundleForm({ ...input, cover: null }),
  })

export const replaceBundleCover = (id: number, cover: File) =>
  apiFetch<TeacherBundle>(`/api/teacher/bundles/${id}/cover`, {
    method: 'PUT',
    body: bundleForm({ title: '', description: '', priceVND: 0, bookIds: [], cover }),
  })
