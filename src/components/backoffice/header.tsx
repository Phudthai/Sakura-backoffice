'use client'

import { LogOut } from 'lucide-react'
import { useAuth } from '@/context/auth-context'

export default function BackofficeHeader() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-20 flex h-14 items-center justify-end border-b border-card-border bg-white px-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-sakura-600">
          {user?.name ?? 'Admin'}
        </span>
        <button
          onClick={() => logout()}
          className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-sakura-600 transition-colors hover:bg-sakura-50 hover:text-sakura-900"
        >
          <LogOut className="h-4 w-4" />
          Logout
        </button>
      </div>
    </header>
  )
}
