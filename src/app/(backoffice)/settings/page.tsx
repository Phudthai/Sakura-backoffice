'use client'

import { Settings } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div>
      <h1 className="text-xl font-semibold text-sakura-900 mb-6">Settings</h1>

      <div className="rounded-xl border border-card-border bg-white shadow-card p-8 text-center">
        <Settings className="mx-auto h-12 w-12 text-sakura-300 mb-4" />
        <h2 className="text-base font-medium text-sakura-700 mb-2">
          Settings page is under construction
        </h2>
        <p className="text-sm text-muted-dark">
          Admin account management and site configuration will be available here.
        </p>
      </div>
    </div>
  )
}
