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
  transaction_no?: string
  response_code?: string
}

export const createOrder = (input: { bookSlug?: string; bundleSlug?: string }) =>
  postJSON<OrderResponse>('/api/orders', {
    book_slug: input.bookSlug,
    bundle_slug: input.bundleSlug,
  })

export const getOrder = (txnRef: string) =>
  apiFetch<OrderResponse>(`/api/orders/${encodeURIComponent(txnRef)}`)

export interface OrderListItem extends OrderResponse {
  item_title: string
  item_slug: string
  created_at: string
}

// The buyer's own history: what happened to a payment the browser never confirmed.
export const listMyOrders = () => apiFetch<OrderListItem[]>('/api/orders')
