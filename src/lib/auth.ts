import jwt from 'jsonwebtoken'
import { cookies } from 'next/headers'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const JWT_SECRET = process.env.JWT_SECRET || 'sakura-dev-secret-change-in-production'
const JWT_EXPIRES_IN = '7d'
const COOKIE_NAME = 'sakura_token'
const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 // 7 days in seconds

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JwtPayload {
  userId: string
  email: string
  role: string
}

export interface SafeUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  isEmailVerified: boolean
  createdAt: Date
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

/** Create a JWT for a user */
export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN })
}

/** Verify and decode a JWT — returns null on failure */
export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers (for Next.js API routes — server-side only)
// ---------------------------------------------------------------------------

/** Set the auth cookie */
export function setAuthCookie(token: string) {
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
  })
}

/** Remove the auth cookie */
export function removeAuthCookie() {
  cookies().set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

/** Read the auth cookie */
export function getAuthCookie(): string | undefined {
  return cookies().get(COOKIE_NAME)?.value
}

/** Get the current user from the cookie — returns null if unauthenticated */
export function getCurrentUser(): JwtPayload | null {
  const token = getAuthCookie()
  if (!token) return null
  return verifyToken(token)
}

/** Cookie name export for client-side reference */
export { COOKIE_NAME }

