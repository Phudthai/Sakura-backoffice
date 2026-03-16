'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { formatDateBangkok } from '@/lib/date-utils'
import { Loader2 } from 'lucide-react'

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

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchCustomers = useCallback(async () => {
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/customers`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        setCustomers(json.data)
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
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">List Customers</h1>
        <span className="text-sm text-muted-dark">
          {isLoading ? '...' : `${customers.length} customers`}
        </span>
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
                  <th className="px-5 py-3 font-medium">User Code</th>
                  <th className="px-5 py-3 font-medium">User Name</th>
                  <th className="px-5 py-3 font-medium">Name</th>
                  <th className="px-5 py-3 font-medium">Email</th>
                  <th className="px-5 py-3 font-medium">Phone</th>
                  <th className="px-5 py-3 font-medium text-center">Active</th>
                  <th className="px-5 py-3 font-medium text-center">Email Verified</th>
                  <th className="px-5 py-3 font-medium">Registered</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.id}
                    className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
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
                {customers.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={8} className="px-5 py-12 text-center text-muted">
                      No customers found
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
