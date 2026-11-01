// Buying is one call: the API creates the order and returns the VNPay redirect URL.

import { apiFetch, postJSON } from './client'

export interface OrderResponse {
  id: number
  txn_ref: string
  status: 'pending' | 'paid' | 'failed' | 'cancelled'
  amount_vnd: number
  book_id?: number
  bundle_id?: number
  paid_at?: string
  payment_url?: string
}

export const createOrder = (input: { bookSlug?: string; bundleSlug?: string }) =>
  postJSON<OrderResponse>('/api/orders', {
    book_slug: input.bookSlug,
    bundle_slug: input.bundleSlug,
  })

export const getOrder = (txnRef: string) =>
  apiFetch<OrderResponse>(`/api/orders/${encodeURIComponent(txnRef)}`)
