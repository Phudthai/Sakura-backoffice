import { NextResponse } from 'next/server'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  try {
    const payload = getCurrentUser()
    if (!payload) {
      return NextResponse.json(
        { success: false, error: { code: 'UNAUTHENTICATED', message: 'Not authenticated' } },
        { status: 401 }
      )
    }

    return NextResponse.json(
      { success: true, data: { user: payload } },
      { status: 200 }
    )
  } catch (error) {
    console.error('[Me Error]', error)
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } },
      { status: 500 }
    )
  }
}

