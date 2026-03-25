const MAX_RAW_BODY_CHARS = 200

type ErrorLike = {
  message?: unknown
  code?: unknown
  details?: unknown
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * Extract a human-readable error string from typical backoffice API JSON bodies.
 * Prefers nested error.message, then top-level message, then error.details[], then error.code.
 */
export function getApiErrorMessage(body: unknown, fallback: string): string {
  if (!isRecord(body)) return fallback

  const err = body.error
  if (isRecord(err)) {
    const e = err as ErrorLike
    if (typeof e.message === 'string' && e.message.trim()) return e.message.trim()
    if (Array.isArray(e.details)) {
      const parts = e.details
        .map((d) => {
          if (isRecord(d) && typeof d.message === 'string') return d.message.trim()
          return ''
        })
        .filter(Boolean)
      if (parts.length) return parts.join(', ')
    }
    if (typeof e.code === 'string' && e.code.trim()) return e.code.trim()
  }

  if (typeof body.message === 'string' && body.message.trim()) return body.message.trim()

  return fallback
}

/**
 * When the response body is not JSON, show a short snippet and status (not a generic "Network error").
 */
export function messageFromNonJsonBody(text: string, status: number): string {
  const t = text.trim()
  if (!t) return `คำขอล้มเหลว (HTTP ${status})`
  const truncated = t.length > MAX_RAW_BODY_CHARS ? `${t.slice(0, MAX_RAW_BODY_CHARS)}…` : t
  return `${truncated} (HTTP ${status})`
}

export type ParsedResponse =
  | { kind: 'json'; value: unknown }
  | { kind: 'text'; text: string }

export async function parseResponseJsonOrText(res: Response): Promise<ParsedResponse> {
  const text = await res.text()
  if (!text.trim()) return { kind: 'text', text: '' }
  try {
    return { kind: 'json', value: JSON.parse(text) as unknown }
  } catch {
    return { kind: 'text', text }
  }
}
