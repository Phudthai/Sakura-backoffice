'use client'

import { useState, useEffect, useCallback } from 'react'
import { Plus, X, Loader2 } from 'lucide-react'
import type { Staff } from '@/types/backoffice'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { formatDateBangkok } from '@/lib/date-utils'

export default function StaffsPage() {
  const [staffs, setStaffs] = useState<Staff[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)

  const fetchStaffs = useCallback(async () => {
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/staffs`)
      const json = await res.json()
      if (json.success) {
        setStaffs(json.data ?? [])
      } else {
        setError(json.error?.message ?? 'Failed to load staffs')
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStaffs()
  }, [fetchStaffs])

  const handleAdd = async () => {
    if (!form.name) return
    setIsSubmitting(true)
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/staffs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name }),
      })
      const json = await res.json()
      if (json.success) {
        setForm({ name: '' })
        setShowForm(false)
        fetchStaffs()
      } else {
        setError(json.error?.message ?? 'Failed to create staff')
      }
    } catch {
      setError('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">Staffs</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" /> Add Staff
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline">dismiss</button>
        </div>
      )}

      {/* Add Staff Form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-card-border bg-white shadow-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-sakura-900">New Staff</h2>
            <button onClick={() => setShowForm(false)} className="text-muted hover:text-sakura-700 transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-sakura-700 mb-1">Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ name: e.target.value })}
                className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                placeholder="Staff name"
                autoFocus
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!form.name || isSubmitting}
              className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Add Staff
            </button>
          </div>
        </div>
      )}

      {/* Staff Table */}
      <div className="rounded-xl border border-card-border bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs text-muted-dark bg-sakura-50">
                  <th className="px-5 py-3 font-medium">รหัส</th>
                  <th className="px-5 py-3 font-medium">ชื่อ</th>
                  <th className="px-5 py-3 font-medium">วันที่สร้าง</th>
                </tr>
              </thead>
              <tbody>
                {staffs.map((staff) => (
                  <tr
                    key={staff.id}
                    className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
                  >
                    <td className="px-5 py-3 text-muted-dark text-xs font-mono">{staff.id}</td>
                    <td className="px-5 py-3 font-medium text-sakura-900">{staff.name}</td>
                    <td className="px-5 py-3 text-muted-dark">
                      {formatDateBangkok(staff.createdAt)}
                    </td>
                  </tr>
                ))}
                {staffs.length === 0 && (
                  <tr>
                    <td colSpan={3} className="px-5 py-8 text-center text-muted-dark">
                      No staffs found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
