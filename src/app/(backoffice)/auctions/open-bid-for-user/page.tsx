'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import Image from 'next/image'
import { ExternalLink, Search, Loader2, Plus, Send, X, Link2, Pencil, Check } from 'lucide-react'
import { formatPrice } from '@/lib/utils'

interface AuctionRequest {
  id: number
  userId: number
  url: string
  itemId: string
  title: string
  imageUrl: string
  endTime: string
  status: string
  currentPrice: number
  note: string | null
  username?: string
  externalId?: string
  register_url?: string
  lastBid?: { price: number; status: string }
}

function useCountdown(endISO?: string | null) {
  const [text, setText] = useState<string>(() => {
    if (!endISO) return '-'
    const diff = new Date(endISO).getTime() - Date.now()
    if (diff <= 0) return 'Ended'
    const hours = Math.floor(diff / 3600_000)
    const minutes = Math.floor((diff % 3600_000) / 60_000)
    const seconds = Math.floor((diff % 60_000) / 1000)
    if (hours >= 24) {
      const days = Math.floor(hours / 24)
      return `${days}d ${hours % 24}h ${minutes}m`
    }
    return `${hours}h ${minutes}m ${seconds}s`
  })

  useEffect(() => {
    if (!endISO) return
    const tick = () => {
      const diff = new Date(endISO).getTime() - Date.now()
      if (diff <= 0) {
        setText('Ended')
        return
      }
      const hours = Math.floor(diff / 3600_000)
      const minutes = Math.floor((diff % 3600_000) / 60_000)
      const seconds = Math.floor((diff % 60_000) / 1000)
      if (hours >= 24) {
        const days = Math.floor(hours / 24)
        setText(`${days}d ${hours % 24}h ${minutes}m`)
      } else {
        setText(`${hours}h ${minutes}m ${seconds}s`)
      }
    }
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [endISO])

  return text
}

function Countdown({ endISO }: { endISO?: string | null }) {
  const text = useCountdown(endISO)
  const isEnded = text === 'Ended'
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums ${
        isEnded ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {text}
    </span>
  )
}

async function submitToBackend(
  url: string,
  firstBidPrice?: number
): Promise<{ id: number; data: unknown }> {
  const res = await fetch(`${API_BACKOFFICE_PREFIX}/auction-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      firstBidPrice: firstBidPrice ? Number(firstBidPrice) : undefined,
    }),
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'บันทึกไม่สำเร็จ')
  }
  return { id: json.data.id, data: json.data }
}

export default function OpenBidForUserPage() {
  const [items, setItems] = useState<AuctionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [firstBidPrice, setFirstBidPrice] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const bidsRes = await fetch(`${API_BACKOFFICE_PREFIX}/auction-requests?page=1&limit=20&status=pending`)
      const bidsJson = await bidsRes.json()
      if (bidsJson.success) setItems(bidsJson.data ?? [])
      else setError(bidsJson.error?.message ?? 'Failed to load auction requests')
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const filtered = filterUser
    ? items.filter(
        (item) =>
          (item.title ?? '').toLowerCase().includes(filterUser.toLowerCase()) ||
          (item.username ?? '').toLowerCase().includes(filterUser.toLowerCase()) ||
          (item.externalId ?? '').toLowerCase().includes(filterUser.toLowerCase()) ||
          String(item.id).includes(filterUser)
      )
    : items

  const handleOpenModal = () => {
    setModalOpen(true)
    setFormError('')
    setUrl('')
    setFirstBidPrice('')
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setFormError('')
    setUrl('')
    setFirstBidPrice('')
  }

  const startEditNote = (itemId: number, currentNote: string | null) => {
    setEditingNoteId(itemId)
    setEditingNoteValue(currentNote ?? '')
  }

  const cancelEditNote = () => {
    setEditingNoteId(null)
    setEditingNoteValue('')
  }

  const saveNote = async () => {
    if (editingNoteId == null) return
    const value = editingNoteValue.trim() || null
    if (value && value.length > 2000) {
      setError('Note must be at most 2000 characters')
      return
    }
    setNoteSaving(true)
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/auction-requests/${editingNoteId}/note`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: value }),
      })
      const json = await res.json()
      if (json.success) {
        setItems((prev) =>
          prev.map((item) => (item.id === editingNoteId ? { ...item, note: value } : item))
        )
        cancelEditNote()
      } else {
        setError(json.error?.message ?? 'Failed to save note')
      }
    } catch {
      setError('Network error')
    } finally {
      setNoteSaving(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setIsSubmitting(true)
    try {
      const price = firstBidPrice ? Number(firstBidPrice.replace(/[^0-9]/g, '')) : undefined
      await submitToBackend(url.trim(), price)
      handleCloseModal()
      fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">เปิดประมูลสินค้าให้ลูกค้า</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700">
            {filtered.length} รายการ
          </span>
          <button
            type="button"
            onClick={handleOpenModal}
            className="btn-gradient inline-flex items-center justify-center gap-2 px-5 py-2.5"
          >
            <Plus className="h-4 w-4" />
            เปิดประมูล
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center justify-between">
          {error}
          <button onClick={() => setError('')} className="text-red-500 hover:text-red-700 font-medium">
            Dismiss
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-5">
        <div className="relative w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder="ค้นหาตามชื่อสินค้า, User Name หรือ User ID..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-card-border bg-white text-sm
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-shadow"
          />
        </div>
      </div>

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
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">User ID</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">User Name</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">Product</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">Auction URL</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">Current Bid</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">Request Bid</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">End Time</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-24 whitespace-nowrap">Status</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">Note</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">Register URL</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-sakura-100 last:border-0 hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="px-6 py-5 align-middle text-center w-36">
                      <span className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-medium text-sakura-800 max-w-full truncate" title={item.externalId ?? undefined}>
                        {item.externalId ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-36">
                      <span className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-semibold text-sakura-800">
                        {item.username ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle">
                      <div className="flex items-center gap-4">
                        {item.imageUrl ? (
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sakura-100 ring-1 ring-sakura-200/50">
                            <Image
                              src={item.imageUrl}
                              alt={item.title ?? 'Product'}
                              fill
                              className="object-cover"
                              sizes="56px"
                            />
                          </div>
                        ) : (
                          <div className="h-14 w-14 shrink-0 rounded-xl bg-sakura-100 flex items-center justify-center text-muted text-xs ring-1 ring-sakura-200/50">
                            —
                          </div>
                        )}
                        <span className="font-medium text-sakura-900 line-clamp-2 max-w-[200px] leading-snug">
                          {item.title ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-36">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.url}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline text-xs font-medium"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          Link
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-[120px]">
                      <div className="flex min-h-[56px] w-full items-center justify-center">
                        <span className="font-bold tabular-nums text-sakura-900 whitespace-nowrap">
                          ¥{formatPrice(item.currentPrice)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-[120px]">
                      <div className="flex min-h-[56px] w-full items-center justify-center">
                        <span className="font-bold tabular-nums text-indigo-700 whitespace-nowrap">
                          ¥{formatPrice(item.lastBid?.price)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      <Countdown endISO={item.endTime} />
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-24">
                      <span
                        className={`inline-flex items-center rounded-lg px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                          item.status === 'pending'
                            ? 'bg-amber-100 text-amber-800'
                            : item.status === 'approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                        }`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      {editingNoteId === item.id ? (
                        <div className="flex flex-col gap-1.5 min-w-[180px]">
                          <textarea
                            value={editingNoteValue}
                            onChange={(e) => setEditingNoteValue(e.target.value.slice(0, 2000))}
                            placeholder="Add note..."
                            rows={2}
                            maxLength={2000}
                            className="rounded-lg border border-sakura-200 px-2.5 py-1.5 text-xs resize-none
                                       focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                            autoFocus
                          />
                          <div className="flex gap-1.5">
                            <button
                              onClick={saveNote}
                              disabled={noteSaving}
                              className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white
                                         hover:bg-indigo-700 disabled:opacity-50"
                            >
                              {noteSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                              Save
                            </button>
                            <button
                              onClick={cancelEditNote}
                              className="rounded border border-sakura-200 px-2 py-1 text-xs font-medium text-sakura-600 hover:bg-sakura-50"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEditNote(item.id, item.note ?? null)}
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-sakura-600 hover:bg-sakura-50 hover:text-sakura-800 transition-colors text-left min-h-[32px]"
                        >
                          <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                          <span className="line-clamp-2 max-w-[140px]">
                            {item.note?.trim() || 'Add note'}
                          </span>
                        </button>
                      )}
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-36">
                      {item.register_url ? (
                        <a
                          href={item.register_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.register_url}
                          className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-700 hover:underline text-xs font-medium"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          Link
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td className="px-6 py-5 align-middle text-center">
                      <span className="text-muted">—</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={11} className="px-6 py-16 text-center align-middle">
                      <p className="text-sakura-500 font-medium">
                        {filterUser ? `No bids found for "${filterUser}"` : 'No data'}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {filterUser ? 'Try a different search term' : 'กดปุ่ม เปิดประมูล เพื่อเพิ่มรายการ'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl border border-card-border shadow-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-sakura-900">เปิดประมูลสินค้า</h2>
              <button
                type="button"
                onClick={handleCloseModal}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900 transition-colors"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm flex items-center justify-between">
                {formError}
                <button onClick={() => setFormError('')} className="text-red-500 hover:text-red-700 font-medium">
                  Dismiss
                </button>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                  ลิงค์สินค้า <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="url"
                    required
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://auctions.yahoo.co.jp/jp/auction/..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                               bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                               focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent
                               transition-all"
                  />
                </div>
                <p className="mt-1.5 text-xs text-muted">รองรับ Yahoo Auctions Japan</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-sakura-900 mb-1.5">ราคา Bid ครั้งแรก</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={firstBidPrice}
                    onChange={(e) => setFirstBidPrice(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="เช่น 50000"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                               bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                               focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent
                               transition-all"
                  />
                </div>
                <p className="mt-1.5 text-xs text-red-500">
                  * กรุณาใส่ราคา Bid ขั้นต่ำมากกว่า 100 ¥ ของราคาสินค้าปัจจุบัน
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-gradient w-full flex items-center justify-center gap-2 py-3 text-base"
              >
                {isSubmitting ? (
                  <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    ส่งลิงค์สินค้า
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
