import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/**
 * Proxy a request to the backend API, forwarding the auth cookie as a Bearer token.
 */
export async function proxyToBackend(
  request: NextRequest,
  path: string,
  options: { method?: string; body?: unknown } = {}
) {
  const token = request.cookies.get(COOKIE_NAME)?.value

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await fetch(`${API_URL}${path}`, {
      method: options.method ?? 'GET',
      headers,
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })

    const data = await res.json()
    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error(`[API Proxy] ${path}`, error)
    return NextResponse.json(
      { success: false, error: { code: 'PROXY_ERROR', message: 'Backend unreachable' } },
      { status: 502 }
    )
  }
}
