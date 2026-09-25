export const API_BASE = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export const apiEnabled = Boolean(API_BASE)

export async function api(path, { method = 'GET', body, key } = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    signal: AbortSignal.timeout(15000),
    method, credentials: 'include',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(key ? { 'Idempotency-Key': key } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const error = new Error(Array.isArray(data.message) ? data.message.join('; ') : data.message || `Request failed (${response.status})`)
    error.status = response.status
    throw error
  }
  return data
}
