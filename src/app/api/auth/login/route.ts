import { NextRequest, NextResponse } from 'next/server'
import { COOKIE_NAME } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()
    const token = data.data?.token

    console.log('[Login] backend status:', res.status, 'success:', data.success, 'hasToken:', !!token)
    if (token) {
      const parts = token.split('.')
      if (parts.length === 3) {
        try {
          const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString())
          console.log('[Login] JWT payload:', JSON.stringify(payload))
        } catch (e) {
          console.log('[Login] JWT decode error:', e)
        }
      }
    }

    if (token) {
      const { token: _token, ...rest } = data.data
      const response = NextResponse.json({ ...data, data: rest }, { status: res.status })

      if (data.success) {
        response.cookies.set(COOKIE_NAME, token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          path: '/',
          maxAge: COOKIE_MAX_AGE,
        })
      }

      return response
    }

    return NextResponse.json(data, { status: res.status })
  } catch (error) {
    console.error('[Login Error]', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' } },
      { status: 500 }
    )
  }
}

