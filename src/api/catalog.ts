// Types and calls for the public storefront endpoints.

import { apiFetch } from './client'

export type Kind = 'book' | 'bundle'

export interface Card {
  kind: Kind
  id: number
  slug: string
  title: string
  cover_url: string
  access_type: 'free' | 'paid'
  price_vnd: number | null
  age_min: number | null
  age_max: number | null
  tag_slugs: string[]
  book_count?: number
  page_count: number | null
  has_audio: boolean
  has_video: boolean
  published_at: string
}

export interface CatalogPage {
  items: Card[]
  has_more: boolean
}

export interface BookDetailResponse {
  book: Card
  description: string
  has_epub: boolean
}

export interface BundleDetailResponse {
  bundle: Card
  description: string
  books: Card[]
}

export interface Tag {
  id: number
  slug: string
  name: string
  created_by: number | null
}

export interface ReadSession {
  url: string
  source: 'free' | 'purchase' | 'bundle'
  expires_in: number
}

export interface CatalogQuery {
  kind?: Kind | 'all'
  q?: string
  tag?: string
  age?: number
  page?: number
  limit?: number
}

export function listCatalog(query: CatalogQuery = {}): Promise<CatalogPage> {
  const params = new URLSearchParams()
  if (query.kind && query.kind !== 'all') params.set('kind', query.kind)
  if (query.q) params.set('q', query.q)
  if (query.tag) params.set('tag', query.tag)
  if (query.age !== undefined) params.set('age', String(query.age))
  if (query.page) params.set('page', String(query.page))
  if (query.limit) params.set('limit', String(query.limit))

  const suffix = params.toString()
  return apiFetch<CatalogPage>(`/api/books${suffix ? `?${suffix}` : ''}`)
}

export const getBook = (slug: string) =>
  apiFetch<BookDetailResponse>(`/api/books/${encodeURIComponent(slug)}`)

export const getBundle = (slug: string) =>
  apiFetch<BundleDetailResponse>(`/api/bundles/${encodeURIComponent(slug)}`)

export const listTags = () => apiFetch<Tag[]>('/api/tags')

export const startReading = (slug: string) =>
  apiFetch<ReadSession>(`/api/books/${encodeURIComponent(slug)}/read`)
