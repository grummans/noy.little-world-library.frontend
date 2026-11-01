// Thin fetch wrapper for the Go API. In dev Vite proxies /api to :8080, in production
// Nginx Proxy Manager routes /api to the API container, so relative URLs are enough and
// the session cookie stays same-origin.

export class ApiError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

type ErrorBody = { code?: string; message?: string }

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  // FormData sets its own multipart boundary; forcing JSON would break the upload.
  if (init.body !== undefined && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response: Response
  try {
    response = await fetch(path, { ...init, headers, credentials: 'include' })
  } catch {
    throw new ApiError(0, 'network', 'Không kết nối được máy chủ. Bé thử lại nhé.')
  }

  if (response.status === 204) {
    return undefined as T
  }

  const text = await response.text()
  const payload = text ? safeParse(text) : undefined

  if (!response.ok) {
    const body = payload as ErrorBody | undefined
    throw new ApiError(
      response.status,
      body?.code ?? `http_${response.status}`,
      body?.message ?? 'Có lỗi xảy ra, vui lòng thử lại.',
    )
  }

  return payload as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export const postJSON = <T>(path: string, body: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) })

export const putJSON = <T>(path: string, body: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) })
