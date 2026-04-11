'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { formatDateBangkok } from '@/lib/date-utils'
import { Loader2, Search } from 'lucide-react'

interface Customer {
  id: number
  userCode: string | null
  username: string | null
  email: string
  name: string
  phone: string | null
  isActive: boolean
  isEmailVerified: boolean
  createdAt: string
}

/** แปลงแถวจาก GET /api/backoffice/users?role=customer ให้ตรงกับ UI */
function normalizeCustomerRow(raw: unknown): Customer | null {
  if (raw == null || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const idRaw = r.id
  const id = typeof idRaw === 'number' ? idRaw : Number(idRaw)
  if (!Number.isFinite(id)) return null
  const name =
    (typeof r.name === 'string' && r.name) ||
    (typeof r.fullName === 'string' && r.fullName) ||
    (typeof r.displayName === 'string' && r.displayName) ||
    '-'
  const createdAt = r.createdAt ?? r.created_at
  if (createdAt == null) return null
  return {
    id,
    userCode: typeof r.userCode === 'string' ? r.userCode : (r.user_code as string | null) ?? null,
    username: typeof r.username === 'string' ? r.username : (r.user_name as string | null) ?? null,
    email: typeof r.email === 'string' ? r.email : '',
    name,
    phone: r.phone == null ? null : String(r.phone),
    isActive: typeof r.isActive === 'boolean' ? r.isActive : Boolean(r.is_active ?? true),
    isEmailVerified:
      typeof r.isEmailVerified === 'boolean'
        ? r.isEmailVerified
        : Boolean(r.is_email_verified ?? false),
    createdAt: String(createdAt),
  }
}

function navigateToPurchasedForCustomer(
  router: ReturnType<typeof useRouter>,
  customer: Customer
) {
  const u = customer.username?.trim() || customer.userCode?.trim()
  if (u) {
    router.push(`/auctions/completed?username=${encodeURIComponent(u)}`)
  } else {
    router.push('/auctions/completed')
  }
}

function customerMatchesSearch(customer: Customer, q: string): boolean {
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true
  const fields = [
    customer.userCode,
    customer.username,
    customer.name,
    customer.email,
    customer.phone,
  ].map((s) => (s ?? '').toLowerCase())
  return tokens.every((token) => fields.some((f) => f.includes(token)))
}

export default function CustomersPage() {
  const router = useRouter()
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  /** ค้นหาในรหัสผู้ใช้ / ชื่อผู้ใช้ / ชื่อ / อีเมล / เบอร์ */
  const [filterSearch, setFilterSearch] = useState('')
  /** ทั้งหมด | active | inactive */
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all')
  /** ทั้งหมด | verified | unverified */
  const [filterEmail, setFilterEmail] = useState<'all' | 'verified' | 'unverified'>('all')

  const filteredCustomers = useMemo(() => {
    const q = filterSearch.trim().toLowerCase()
    return customers.filter((c) => {
      if (!customerMatchesSearch(c, q)) return false
      if (filterActive === 'active' && !c.isActive) return false
      if (filterActive === 'inactive' && c.isActive) return false
      if (filterEmail === 'verified' && !c.isEmailVerified) return false
      if (filterEmail === 'unverified' && c.isEmailVerified) return false
      return true
    })
  }, [customers, filterSearch, filterActive, filterEmail])

  const hasActiveFilters =
    filterSearch.trim() !== '' || filterActive !== 'all' || filterEmail !== 'all'

  const fetchCustomers = useCallback(async () => {
    try {
      const qs = new URLSearchParams({ role: 'customer' })
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/users?${qs}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const rows = json.data
          .map(normalizeCustomerRow)
          .filter((c: Customer | null): c is Customer => c != null)
        setCustomers(rows)
        setError('')
      } else {
        setError(json.error?.message ?? 'Failed to load customers')
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCustomers()
  }, [fetchCustomers])

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">รายชื่อลูกค้า</h1>
        <span className="text-sm text-muted-dark shrink-0">
          {isLoading
            ? '...'
            : hasActiveFilters
              ? `แสดง ${filteredCustomers.length} รายการ (จาก ${customers.length})`
              : `${customers.length} รายการ`}
        </span>
      </div>

      <div className="mb-6 flex flex-col gap-3 rounded-xl border border-card-border bg-white p-4 shadow-card sm:flex-row sm:flex-wrap sm:items-end">
        <div className="min-w-0 flex-1 sm:min-w-[240px]">
          <label htmlFor="customer-filter-search" className="block text-xs font-medium text-sakura-700 mb-1.5">
            ค้นหา
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              id="customer-filter-search"
              type="search"
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              placeholder="รหัสผู้ใช้, ชื่อผู้ใช้, ชื่อ, อีเมล, เบอร์โทร"
              className="w-full rounded-lg border border-card-border py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
            />
          </div>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[140px]">
          <label htmlFor="customer-filter-active" className="block text-xs font-medium text-sakura-700 mb-1.5">
            สถานะบัญชี
          </label>
          <select
            id="customer-filter-active"
            value={filterActive}
            onChange={(e) => setFilterActive(e.target.value as 'all' | 'active' | 'inactive')}
            className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent bg-white"
          >
            <option value="all">ทั้งหมด</option>
            <option value="active">ใช้งาน</option>
            <option value="inactive">ไม่ใช้งาน</option>
          </select>
        </div>
        <div className="w-full sm:w-auto sm:min-w-[160px]">
          <label htmlFor="customer-filter-email" className="block text-xs font-medium text-sakura-700 mb-1.5">
            ยืนยันอีเมล
          </label>
          <select
            id="customer-filter-email"
            value={filterEmail}
            onChange={(e) => setFilterEmail(e.target.value as 'all' | 'verified' | 'unverified')}
            className="w-full rounded-lg border border-card-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent bg-white"
          >
            <option value="all">ทั้งหมด</option>
            <option value="verified">ยืนยันแล้ว</option>
            <option value="unverified">ยังไม่ยืนยัน</option>
          </select>
        </div>
        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => {
              setFilterSearch('')
              setFilterActive('all')
              setFilterEmail('all')
            }}
            className="w-full rounded-lg border border-card-border px-3 py-2 text-sm font-medium text-sakura-800 hover:bg-sakura-50 transition-colors sm:w-auto"
          >
            ล้างตัวกรอง
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-medium">
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-xl border border-card-border bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-card-border text-left text-xs text-muted-dark bg-sakura-50">
                  <th className="px-5 py-3 font-medium">รหัสผู้ใช้</th>
                  <th className="px-5 py-3 font-medium">ชื่อผู้ใช้</th>
                  <th className="px-5 py-3 font-medium">ชื่อ</th>
                  <th className="px-5 py-3 font-medium">อีเมล</th>
                  <th className="px-5 py-3 font-medium">เบอร์โทร</th>
                  <th className="px-5 py-3 font-medium text-center">ใช้งาน</th>
                  <th className="px-5 py-3 font-medium text-center">ยืนยันอีเมล</th>
                  <th className="px-5 py-3 font-medium">วันที่สมัคร</th>
                </tr>
              </thead>
              <tbody>
                {filteredCustomers.map((customer) => (
                  <tr
                    key={customer.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigateToPurchasedForCustomer(router, customer)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        navigateToPurchasedForCustomer(router, customer)
                      }
                    }}
                    className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors cursor-pointer"
                  >
                    <td className="px-5 py-3 font-mono text-sakura-800">
                      {customer.userCode ?? '-'}
                    </td>
                    <td className="px-5 py-3 font-medium text-sakura-900">
                      {customer.username ?? '-'}
                    </td>
                    <td className="px-5 py-3 font-medium text-sakura-900">
                      {customer.name}
                    </td>
                    <td className="px-5 py-3 text-sakura-700">
                      {customer.email}
                    </td>
                    <td className="px-5 py-3 text-sakura-700">
                      {customer.phone ?? <span className="text-muted">-</span>}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          customer.isActive ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                        title={customer.isActive ? 'Active' : 'Inactive'}
                      />
                    </td>
                    <td className="px-5 py-3 text-center">
                      {customer.isEmailVerified ? (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-green-500"
                          title="Verified"
                        />
                      ) : (
                        <span
                          className="inline-block h-2 w-2 rounded-full bg-gray-300"
                          title="Not verified"
                        />
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-dark">
                      {formatDateBangkok(customer.createdAt)}
                    </td>
                  </tr>
                ))}
                {filteredCustomers.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted">
                      {customers.length === 0
                        ? 'ไม่พบลูกค้า'
                        : 'ไม่พบลูกค้าที่ตรงกับตัวกรอง'}
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
