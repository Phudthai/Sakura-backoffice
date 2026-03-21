'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_BACKOFFICE_PREFIX, API_BASE_URL } from '@/lib/api-config'
import { Check, X, Loader2, ImageIcon } from 'lucide-react'

interface PendingSlip {
  receiptId: number
  userId: number
  user: { id: number; userCode: string; name: string; email: string }
  month: number | null
  year: number | null
  transportType: 'sea' | 'air' | null
  purpose: string | null
  slipImageUrl: string
  amount: number
  status: string
  createdAt: string
}

const PURPOSE_DOMESTIC = 'DOMESTIC_SHIPPING'

interface SlipsMeta {
  total: number
  page: number
  limit: number
  totalPages: number
}

const MONTH_NAMES = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.']

function getSlipImageUrl(url: string): string {
  if (!url) return ''
  if (url.startsWith('http')) return url
  const base = API_BASE_URL.replace(/\/$/, '')
  const path = url.startsWith('/') ? url : `/${url}`
  return `${base}${path}`
}

export default function SlipsPendingPage() {
  const [slips, setSlips] = useState<PendingSlip[]>([])
  const [meta, setMeta] = useState<SlipsMeta | null>(null)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [approvingId, setApprovingId] = useState<number | null>(null)
  const [approveAmount, setApproveAmount] = useState('')
  const [rejectingId, setRejectingId] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

  const limit = 20

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/slip-submissions/pending?page=${page}&limit=${limit}`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (json.success) {
        setSlips(json.data ?? [])
        setMeta(json.meta ?? null)
      } else {
        setError(json.error?.message ?? 'Failed to load pending slips')
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [page])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const cancelAction = () => {
    setApprovingId(null)
    setApproveAmount('')
    setRejectingId(null)
    setRejectReason('')
  }

  const handleApprove = async (receiptId: number) => {
    const amount = Number(approveAmount.replace(/[^0-9.]/g, ''))
    if (!amount || amount <= 0) {
      setError('กรุณาระบุจำนวนเงินที่โอน')
      return
    }
    setActionLoading(true)
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/slip-submissions/${receiptId}/approve`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount }),
          credentials: 'include',
        }
      )
      const json = await res.json()
      if (json.success) {
        cancelAction()
        fetchData()
      } else {
        setError(json.error?.message ?? 'Approve failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  const handleReject = async (receiptId: number) => {
    setActionLoading(true)
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/slip-submissions/${receiptId}/reject`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: rejectReason.trim() || undefined }),
          credentials: 'include',
        }
      )
      const json = await res.json()
      if (json.success) {
        cancelAction()
        fetchData()
      } else {
        setError(json.error?.message ?? 'Reject failed')
      }
    } catch {
      setError('Network error')
    } finally {
      setActionLoading(false)
    }
  }

  const openApprove = (receiptId: number) => {
    cancelAction()
    setApprovingId(receiptId)
    setApproveAmount('')
  }

  const openReject = (receiptId: number) => {
    cancelAction()
    setRejectingId(receiptId)
    setRejectReason('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">สลิปรอตรวจสอบ</h1>
          <p className="mt-1 text-sm text-muted">
            เปิดสลิป ตรวจสอบและกรอกจำนวนเงิน — สลิป &quot;ค่าส่งในไทย&quot; จ่ายเฉพาะยอดค้างค่าส่งในไทยของลูกค้า
          </p>
        </div>
        <span className="rounded-full bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700">
          {meta?.total ?? 0} รายการ
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

      <div className="rounded-2xl border border-sakura-200/60 bg-white shadow-card overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sakura-200 bg-sakura-50/80">
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle">ลูกค้า</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle">ประเภทสลิป</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle">เดือน/ปี</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle">ประเภท</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle">สลิป</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {slips.map((slip) => {
                  const isApproving = approvingId === slip.receiptId
                  const isRejecting = rejectingId === slip.receiptId
                  const slipImgUrl = getSlipImageUrl(slip.slipImageUrl)
                  const isDomestic = slip.purpose === PURPOSE_DOMESTIC

                  return (
                    <tr
                      key={slip.receiptId}
                      className="border-b border-sakura-100 last:border-0 hover:bg-sakura-50/50 transition-colors"
                    >
                      <td className="px-6 py-4 align-middle">
                        <div>
                          <span className="font-mono text-xs text-muted">{slip.user.userCode}</span>
                          <p className="font-medium text-sakura-900">{slip.user.name}</p>
                          <p className="text-xs text-muted">{slip.user.email}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                          isDomestic ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          {isDomestic ? 'ค่าส่งในไทย' : 'รายเดือน'}
                        </span>
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {isDomestic ? (
                          <span className="text-muted">—</span>
                        ) : slip.month != null && slip.year != null ? (
                          `${MONTH_NAMES[slip.month - 1]} ${slip.year + 543}`
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {isDomestic ? (
                          <span className="text-muted">—</span>
                        ) : slip.transportType ? (
                          <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${
                            slip.transportType === 'air' ? 'bg-sky-100 text-sky-700' : 'bg-teal-100 text-teal-700'
                          }`}>
                            {slip.transportType === 'air' ? 'Air' : 'Sea'}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        {slipImgUrl ? (
                          <button
                            type="button"
                            onClick={() => setImagePreviewUrl(slipImgUrl)}
                            className="block relative w-16 h-16 rounded-lg overflow-hidden border border-sakura-200 hover:ring-2 hover:ring-indigo-200 transition-all"
                          >
                            <img
                              src={slipImgUrl}
                              alt="Slip"
                              className="w-full h-full object-cover"
                            />
                          </button>
                        ) : (
                          <div className="w-16 h-16 rounded-lg bg-sakura-100 flex items-center justify-center text-muted">
                            <ImageIcon className="h-6 w-6" />
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 align-middle">
                        <div className="flex justify-center gap-2">
                          {isApproving ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              {isDomestic && (
                                <p className="text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200/60">
                                  สลิปค่าส่งในไทย — ตรวจยอดค้างของ user ให้ตรงก่อนอนุมัติ
                                </p>
                              )}
                              <input
                                type="number"
                                value={approveAmount}
                                onChange={(e) => setApproveAmount(e.target.value)}
                                placeholder="จำนวนเงิน (บาท)"
                                min="0"
                                step="0.01"
                                className="rounded-lg border border-sakura-200 px-3 py-2 text-sm
                                  focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApprove(slip.receiptId)}
                                  disabled={actionLoading || !approveAmount.trim()}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white
                                    hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                  ยืนยัน
                                </button>
                                <button
                                  onClick={cancelAction}
                                  className="rounded-lg border border-sakura-200 px-3 py-2 text-xs font-medium text-sakura-600 hover:bg-sakura-50"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : isRejecting ? (
                            <div className="flex flex-col gap-2 min-w-[200px]">
                              <textarea
                                value={rejectReason}
                                onChange={(e) => setRejectReason(e.target.value)}
                                placeholder="เหตุผล (ถ้ามี)"
                                rows={2}
                                className="rounded-lg border border-sakura-200 px-3 py-2 text-sm resize-none
                                  focus:outline-none focus:ring-2 focus:ring-rose-200 focus:border-rose-300"
                                autoFocus
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleReject(slip.receiptId)}
                                  disabled={actionLoading}
                                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-xs font-semibold text-white
                                    hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                                  ยืนยันปฏิเสธ
                                </button>
                                <button
                                  onClick={cancelAction}
                                  className="rounded-lg border border-sakura-200 px-3 py-2 text-xs font-medium text-sakura-600 hover:bg-sakura-50"
                                >
                                  ยกเลิก
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() => openApprove(slip.receiptId)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white
                                  hover:bg-emerald-700 active:scale-[0.98] transition-all"
                              >
                                <Check className="h-3.5 w-3.5" /> อนุมัติ
                              </button>
                              <button
                                onClick={() => openReject(slip.receiptId)}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white
                                  hover:bg-rose-700 active:scale-[0.98] transition-all"
                              >
                                <X className="h-3.5 w-3.5" /> ปฏิเสธ
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {slips.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={6} className="px-6 py-16 text-center align-middle">
                      <p className="text-sakura-500 font-medium">ไม่มีสลิปรอตรวจสอบ</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {meta && meta.totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-sakura-200 px-6 py-4">
            <p className="text-sm text-muted">
              แสดง {slips.length} จาก {meta.total} รายการ
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-sakura-200 px-3 py-1.5 text-sm font-medium text-sakura-700
                  hover:bg-sakura-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ก่อนหน้า
              </button>
              <span className="px-3 py-1.5 text-sm text-muted">
                หน้า {page} / {meta.totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(meta.totalPages, p + 1))}
                disabled={page >= meta.totalPages}
                className="rounded-lg border border-sakura-200 px-3 py-1.5 text-sm font-medium text-sakura-700
                  hover:bg-sakura-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ถัดไป
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Image preview modal */}
      {imagePreviewUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setImagePreviewUrl(null)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Escape' && setImagePreviewUrl(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={imagePreviewUrl}
              alt="Slip preview"
              className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-xl"
            />
            <button
              type="button"
              onClick={() => setImagePreviewUrl(null)}
              className="absolute -top-2 -right-2 rounded-full bg-white p-1.5 shadow-lg hover:bg-sakura-50 text-sakura-600"
              aria-label="ปิด"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
