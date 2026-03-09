import { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'
import { proxyToBackend } from '@/lib/api-proxy'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

export async function POST(request: NextRequest) {
  try {
    await proxyToBackend(request, `${API_BACKOFFICE_PREFIX}/auth/logout`, { method: 'POST' })
  } catch {
    // ignore backend errors
  }
  const response = NextResponse.json(
    { success: true, message: 'Logged out successfully' },
    { status: 200 }
  )
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
  return response
}
