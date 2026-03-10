'use client'

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string
  email: string
  name: string
  phone: string | null
  role: string
  isEmailVerified: boolean
  createdAt: string
}

interface AuthContextType {
  user: AuthUser | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  register: (data: RegisterData) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

interface RegisterData {
  email: string
  password: string
  name: string
  phone?: string
}

/** Normalize user from API (handles both JWT payload shape and full user) */
function normalizeUser(raw: Record<string, unknown> | null): AuthUser | null {
  if (!raw) return null
  return {
    id: String((raw.id ?? raw.userId ?? '')),
    email: String(raw.email ?? ''),
    name: String(raw.name ?? raw.email ?? ''),
    phone: (raw.phone as string) ?? null,
    role: String(raw.role ?? ''),
    isEmailVerified: Boolean(raw.isEmailVerified ?? true),
    createdAt: String(raw.createdAt ?? ''),
  }
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const FETCH_OPTIONS = { credentials: 'include' as RequestCredentials }

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  /** Fetch current user from /api/backoffice/auth/me */
  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/auth/me`, FETCH_OPTIONS)
      if (res.ok) {
        const json = await res.json()
        setUser(normalizeUser(json.data?.user ?? null))
      } else {
        setUser(null)
      }
    } catch {
      setUser(null)
    }
  }, [])

  /** On mount — check if user is already logged in */
  useEffect(() => {
    refreshUser().finally(() => setIsLoading(false))
  }, [refreshUser])

  /** Login via /api/backoffice/auth/login */
  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch(`${API_BACKOFFICE_PREFIX}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
          credentials: 'include',
        })
        const json = await res.json()

        if (res.ok && json.success) {
          setUser(normalizeUser(json.data?.user ?? null))
          return { success: true }
        }
        return { success: false, error: json.error?.message || 'Login failed' }
      } catch {
        return { success: false, error: 'Network error — please try again' }
      }
    },
    []
  )

  /** Register via /api/backoffice/auth/register (admin registration) */
  const register = useCallback(
    async (data: RegisterData) => {
      try {
        const res = await fetch('/api/backoffice/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
          credentials: 'include',
        })
        const json = await res.json()

        if (res.ok && json.success) {
          setUser(normalizeUser(json.data?.user ?? null))
          return { success: true }
        }
        return { success: false, error: json.error?.message || 'Registration failed' }
      } catch {
        return { success: false, error: 'Network error — please try again' }
      }
    },
    []
  )

  /** Logout via /api/backoffice/auth/logout */
  const logout = useCallback(async () => {
    try {
      await fetch(`${API_BACKOFFICE_PREFIX}/auth/logout`, { method: 'POST', ...FETCH_OPTIONS })
    } catch {
      // ignore
    }
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

