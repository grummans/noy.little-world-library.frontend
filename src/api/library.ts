// Parent shelf: purchased bundles, individually bought books, and what can be resumed.

import { apiFetch } from './client'
import type { Card } from './catalog'

export type OriginType = 'purchase' | 'bundle'

export interface ReadableItem {
  book: Card
  origin: {
    type: OriginType
    bundle_slug?: string
    bundle_name?: string
  }
}

export interface ShelfBundle extends Card {
  purchased_at: string | null
}

export interface Shelf {
  bundles: ShelfBundle[]
  books: Card[]
  readable: ReadableItem[]
}

export const getShelf = () => apiFetch<Shelf>('/api/parent/library')
