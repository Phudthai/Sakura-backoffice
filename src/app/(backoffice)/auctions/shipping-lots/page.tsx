'use client'

import { useState, useEffect, useCallback } from 'react'
import Swal from 'sweetalert2'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { formatDateBangkok, toDateInputValueBangkok, dateStrToBangkokISO } from '@/lib/date-utils'
import { Loader2, Plus, X, Pencil, Check } from 'lucide-react'

interface Lot {
  id: number
  lot_code: string
  intl_shipping_type?: string
  start_lot_at: string
  end_lot_at: string | null
  arrive_at: string | null
  is_arrived?: boolean
  is_delayed?: boolean
  auction_count?: number
  createdAt: string
  updatedAt: string
}

interface LotsMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

type ShippingTab = 'sea' | 'air'

const SHIPPING_TABS: { id: ShippingTab; label: string }[] = [
  { id: 'sea', label: 'Sea' },
  { id: 'air', label: 'Air' },
]

export default function ShippingLotsPage() {
  const [activeTab, setActiveTab] = useState<ShippingTab>('sea')
  const [lots, setLots] = useState<Lot[]>([])
  const [meta, setMeta] = useState<LotsMeta | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLot, setEditingLot] = useState<Lot | null>(null)
  const [lotCode, setLotCode] = useState('')
  const [startLotAt, setStartLotAt] = useState('')
  const [endLotAt, setEndLotAt] = useState('')
  const [arriveAt, setArriveAt] = useState('')
  const [isDelayed, setIsDelayed] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [togglingLotId, setTogglingLotId] = useState<number | null>(null)

  const limit = 20
  const isAirTab = activeTab === 'air'

  const handleToggleIsArrived = async (lot: Lot) => {
    const newValue = !lot.is_arrived
    const { isConfirmed } = await Swal.fire({
      title: newValue ? 'ทำเครื่องหมายถึงไทยแล้ว?' : 'ยกเลิกสถานะถึงแล้ว?',
      text: newValue
        ? `ยืนยันทำเครื่องหมาย Lot ${lot.lot_code} ว่าถึงไทยแล้ว`
        : `ยืนยันยกเลิกสถานะ Lot ${lot.lot_code} ว่ายังไม่ถึงไทย`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
    })
    if (!isConfirmed) return

    setTogglingLotId(lot.id)
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/lots/${lot.id}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_arrived: newValue }),
          credentials: 'include',
        }
      )
      const json = await res.json()
      if (json.success) {
        setLots((prev) =>
          prev.map((l) => (l.id === lot.id ? { ...l, is_arrived: newValue } : l))
        )
      } else {
        setError(json.error?.message ?? 'Failed to update')
      }
    } catch {
      setError('Network error')
    } finally {
      setTogglingLotId(null)
    }
  }

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/lots?page=${page}&limit=${limit}&intl_shipping_type=${activeTab}`,
        { credentials: 'include' }
      )
      const json = await res.json()

      if (json.success) {
        setLots(json.data ?? [])
        setMeta(json.meta ?? null)
      } else {
        setError(json.error?.message ?? 'Failed to load lots')
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [page, activeTab])

  useEffect(() => {
    setIsLoading(true)
    fetchData()
  }, [fetchData])

  const openCreateModal = () => {
    setEditingLot(null)
    setLotCode('')
    setStartLotAt('')
    setEndLotAt('')
    setArriveAt('')
    setIsDelayed(false)
    setFormError('')
    setModalOpen(true)
  }

  const openEditModal = (lot: Lot) => {
    setEditingLot(lot)
    setLotCode(lot.lot_code)
    setStartLotAt(toDateInputValueBangkok(lot.start_lot_at))
    setEndLotAt(toDateInputValueBangkok(lot.end_lot_at))
    setArriveAt(toDateInputValueBangkok(lot.arrive_at))
    setIsDelayed(lot.is_delayed ?? false)
    setFormError('')
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditingLot(null)
    setFormError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')

    const code = lotCode.trim()
    if (!code || code.length < 1 || code.length > 50) {
      setFormError('รหัส lot ต้องมี 1–50 ตัวอักษร')
      return
    }
    if (!startLotAt) {
      setFormError('กรุณาระบุวันเริ่ม lot')
      return
    }
    if (!endLotAt) {
      setFormError('กรุณาระบุวันตัดรอบ lot')
      return
    }

    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        lot_code: code,
        start_lot_at: dateStrToBangkokISO(startLotAt),
        end_lot_at: dateStrToBangkokISO(endLotAt, true),
        arrive_at: arriveAt ? dateStrToBangkokISO(arriveAt) : null,
      }
      body.is_delayed = isAirTab ? isDelayed : false

      if (editingLot) {
        const res = await fetch(
          `${API_BACKOFFICE_PREFIX}/lots/${editingLot.id}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            credentials: 'include',
          }
        )
        const json = await res.json()
        if (json.success) {
          closeModal()
          fetchData()
        } else {
          setFormError(json.error?.message ?? 'Failed to update lot')
        }
      } else {
        const res = await fetch(`${API_BACKOFFICE_PREFIX}/lots`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          credentials: 'include',
        })
        const json = await res.json()
        if (json.success) {
          closeModal()
          fetchData()
        } else {
          setFormError(json.error?.message ?? 'Failed to create lot')
        }
      }
    } catch {
      setFormError('Network error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">
            ล็อตการจัดส่ง
          </h1>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="btn-gradient inline-flex items-center justify-center gap-2 px-5 py-2.5"
        >
          <Plus className="h-4 w-4" />
          สร้าง Lot
        </button>
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-sakura-100/80 border border-sakura-200/60 w-fit">
        {SHIPPING_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveTab(tab.id)
              setPage(1)
            }}
            className={`px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
              activeTab === tab.id
                ? 'bg-white text-sakura-900 shadow-sm'
                : 'text-sakura-600 hover:text-sakura-900 hover:bg-sakura-50/80'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center justify-between">
          {error}
          <button
            onClick={() => setError('')}
            className="text-red-500 hover:text-red-700 font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-sakura-200/60 bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="border-b border-sakura-200 bg-sakura-50/80">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-left w-40">
                    Lot Code
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                    วันเริ่ม
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                    วันตัดรอบ
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                    วันถึงไทย
                  </th>
                  {isAirTab && (
                    <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-24">
                      ล่าช้า
                    </th>
                  )}
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-28">
                    ถึงแล้ว
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-24">
                    จำนวนประมูล
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {lots.map((lot) => (
                  <tr
                    key={lot.id}
                    className="border-b border-sakura-100 last:border-0 hover:bg-indigo-50/30 transition-colors"
                  >
                    <td className="px-6 py-5 align-middle">
                      <span className="font-mono font-semibold text-sakura-900">
                        {lot.lot_code}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      {formatDateBangkok(lot.start_lot_at)}
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      {formatDateBangkok(lot.end_lot_at)}
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      {formatDateBangkok(lot.arrive_at)}
                    </td>
                    {isAirTab && (
                      <td className="px-6 py-5 align-middle text-center">
                        {lot.is_delayed ? (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-900">
                            ล่าช้า
                          </span>
                        ) : (
                          <span className="text-muted text-xs">—</span>
                        )}
                      </td>
                    )}
                    <td className="px-6 py-5 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleIsArrived(lot)}
                        disabled={togglingLotId === lot.id}
                        title={lot.is_arrived ? 'ยกเลิกสถานะถึงแล้ว' : 'ทำเครื่องหมายถึงไทยแล้ว'}
                        className={`inline-flex items-center justify-center w-9 h-9 rounded-lg border-2 transition-colors ${
                          lot.is_arrived
                            ? 'bg-emerald-500 border-emerald-600 text-white'
                            : 'border-sakura-200 bg-white text-muted hover:border-sakura-300 hover:bg-sakura-50'
                        } ${togglingLotId === lot.id ? 'opacity-60 cursor-not-allowed' : ''}`}
                      >
                        {togglingLotId === lot.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" strokeWidth={2.5} />
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      <span className="font-medium tabular-nums">
                        {lot.auction_count ?? 0}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      <button
                        type="button"
                        onClick={() => openEditModal(lot)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        แก้ไข
                      </button>
                    </td>
                  </tr>
                ))}
                {lots.length === 0 && !isLoading && (
                  <tr>
                    <td
                      colSpan={isAirTab ? 8 : 7}
                      className="px-6 py-16 text-center align-middle"
                    >
                      <p className="text-sakura-500 font-medium">
                        ยังไม่มี lot
                      </p>
                      <p className="text-sm text-muted mt-1">
                        กดปุ่ม สร้าง Lot เพื่อเพิ่มรายการ
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-sakura-200 px-4 py-2 text-sm font-medium text-sakura-700 hover:bg-sakura-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ก่อนหน้า
          </button>
          <span className="text-sm text-muted">
            หน้า {meta.page} / {meta.totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
            disabled={page >= meta.totalPages}
            className="rounded-lg border border-sakura-200 px-4 py-2 text-sm font-medium text-sakura-700 hover:bg-sakura-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ถัดไป
          </button>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl border border-card-border shadow-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-sakura-900">
                {editingLot ? 'แก้ไข Lot' : 'สร้าง Lot'}
              </h2>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900 transition-colors"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center justify-between">
                {formError}
                <button
                  onClick={() => setFormError('')}
                  className="text-red-500 hover:text-red-700 font-medium"
                >
                  Dismiss
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                  รหัส Lot <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={lotCode}
                  onChange={(e) => setLotCode(e.target.value.slice(0, 50))}
                  placeholder="LOT-2026-01"
                  maxLength={50}
                  className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
                <p className="mt-1 text-xs text-muted">1–50 ตัวอักษร</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                  วันเริ่ม Lot <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={startLotAt}
                  onChange={(e) => setStartLotAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                  วันตัดรอบ Lot <span className="text-red-400">*</span>
                </label>
                <input
                  type="date"
                  required
                  value={endLotAt}
                  onChange={(e) => setEndLotAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                  วันถึงไทยโดยประมาณ
                </label>
                <input
                  type="date"
                  value={arriveAt}
                  onChange={(e) => setArriveAt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                />
              </div>

              {isAirTab && (
                <label className="flex items-center gap-3 cursor-pointer rounded-xl border border-card-border bg-sakura-50/50 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={isDelayed}
                    onChange={(e) => setIsDelayed(e.target.checked)}
                    className="h-4 w-4 rounded border-sakura-300 text-indigo-600 focus:ring-sakura-400"
                  />
                  <span className="text-sm font-medium text-sakura-900">ล่าช้า</span>
                </label>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-gradient w-full flex items-center justify-center gap-2 py-3 text-base"
              >
                {isSubmitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {editingLot ? 'บันทึก' : 'สร้าง Lot'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
