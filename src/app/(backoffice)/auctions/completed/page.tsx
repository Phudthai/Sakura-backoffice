'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import Image from 'next/image'
import { ExternalLink, Search, Loader2, Pencil, Check, X } from 'lucide-react'
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
  lastBid?: { price: number; status: string }
  lot?: { id: number; lot_code: string } | null
  weight_gram?: number | null
  isPaid?: boolean
  domestic_shipping_baht?: number | null
}

interface DomesticShippingQueueItem {
  userId: number
  userCode: string
  username: string
  pendingDomesticItemCount: number
  lots: { id: number; lotCode: string }[]
  domesticPendingBaht: number
}

interface DomesticQueueItemDetail {
  id: number
  title: string
  imageUrl?: string | null
  status?: string
  bidResult?: unknown
  weightGram?: number | null
  currentPriceBaht?: number
  boughtAt?: string | null
  lot?: { id: number; lotCode: string; isArrived?: boolean; arriveAt?: string | null } | null
  deliveryStages?: Array<{
    stageTypeCode?: string
    stageTypeNameTh?: string
    status?: string
    isPaid?: boolean
    [key: string]: unknown
  }>
}

interface UserItemsResponse {
  userId: number
  userCode: string
  username: string
  pendingDomesticItemCount: number
  domesticPendingBaht: number
  items: DomesticQueueItemDetail[]
}

type ActiveTab = 'not_arrived' | 'air' | 'sea' | 'arrived_th'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'not_arrived', label: 'สินค้าที่ยังไม่ถึงบ้านญี่ปุ่น' },
  { id: 'air', label: 'จัดส่ง air' },
  { id: 'sea', label: 'จัดส่ง sea' },
  { id: 'arrived_th', label: 'สินค้าที่ถึงไทยแล้ว' },
]

function buildAuctionQuery(tab: Exclude<ActiveTab, 'arrived_th'>): string {
  const base = 'page=1&limit=20&status=completed'
  if (tab === 'not_arrived') return `${base}&delivery_stage=0`
  if (tab === 'air') return `${base}&delivery_stage=1&shipping_type=air`
  if (tab === 'sea') return `${base}&delivery_stage=1&shipping_type=sea`
  return base
}

export default function CompletedAuctionsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('not_arrived')
  const [items, setItems] = useState<AuctionRequest[]>([])
  const [domesticQueueItems, setDomesticQueueItems] = useState<DomesticShippingQueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [editingWeightId, setEditingWeightId] = useState<number | null>(null)
  const [editingWeightValue, setEditingWeightValue] = useState('')
  const [weightSaving, setWeightSaving] = useState(false)
  const [editingDomesticUserId, setEditingDomesticUserId] = useState<number | null>(null)
  const [editingDomesticValue, setEditingDomesticValue] = useState('')
  const [domesticSaving, setDomesticSaving] = useState(false)
  const [userItemsModalOpen, setUserItemsModalOpen] = useState(false)
  const [selectedUserForItems, setSelectedUserForItems] = useState<DomesticShippingQueueItem | null>(null)
  const [userItemsData, setUserItemsData] = useState<UserItemsResponse | null>(null)
  const [userItemsLoading, setUserItemsLoading] = useState(false)
  const [userItemsError, setUserItemsError] = useState('')

  const isNotArrivedTab = activeTab === 'not_arrived'
  const isShippingTab = activeTab === 'air' || activeTab === 'sea'
  const isArrivedThTab = activeTab === 'arrived_th'

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      if (activeTab === 'arrived_th') {
        const res = await fetch(
          `${API_BACKOFFICE_PREFIX}/domestic-shipping-queue?page=1&limit=20`,
          { credentials: 'include' }
        )
        const json = await res.json()
        if (json.success) setDomesticQueueItems(json.data ?? [])
        else setError(json.error?.message ?? 'Failed to load domestic shipping queue')
      } else {
        const query = buildAuctionQuery(activeTab)
        const arRes = await fetch(
          `${API_BACKOFFICE_PREFIX}/auction-requests?${query}`,
          { credentials: 'include' }
        )
        const arJson = await arRes.json()
        if (arJson.success) setItems(arJson.data ?? [])
        else setError(arJson.error?.message ?? 'Failed to load completed auctions')
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [activeTab])

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

  const filteredDomestic = filterUser
    ? domesticQueueItems.filter(
        (item) =>
          (item.userCode ?? '').toLowerCase().includes(filterUser.toLowerCase()) ||
          (item.username ?? '').toLowerCase().includes(filterUser.toLowerCase())
      )
    : domesticQueueItems

  const summaryTotal = !isNotArrivedTab && !isArrivedThTab
    ? filtered.reduce((sum, item) => sum + (item.currentPrice ?? 0), 0)
    : 0
  const summaryPaid = !isNotArrivedTab && !isArrivedThTab
    ? filtered.filter((item) => item.isPaid).reduce((sum, item) => sum + (item.currentPrice ?? 0), 0)
    : 0
  const summaryOutstanding = summaryTotal - summaryPaid

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

  const startEditWeight = (itemId: number, currentWeight: number | null) => {
    setEditingWeightId(itemId)
    setEditingWeightValue(currentWeight != null ? String(currentWeight) : '')
  }

  const cancelEditWeight = () => {
    setEditingWeightId(null)
    setEditingWeightValue('')
  }

  const startEditDomestic = (userId: number, currentAmount: number) => {
    setEditingDomesticUserId(userId)
    setEditingDomesticValue(String(currentAmount))
  }

  const cancelEditDomestic = () => {
    setEditingDomesticUserId(null)
    setEditingDomesticValue('')
  }

  const openUserItemsModal = async (item: DomesticShippingQueueItem) => {
    setSelectedUserForItems(item)
    setUserItemsModalOpen(true)
    setUserItemsData(null)
    setUserItemsError('')
    setUserItemsLoading(true)
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/domestic-shipping-queue/${item.userId}/items`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (json.success) {
        setUserItemsData(json.data)
      } else {
        setUserItemsError(json.error?.message ?? 'Failed to load items')
      }
    } catch {
      setUserItemsError('Network error')
    } finally {
      setUserItemsLoading(false)
    }
  }

  const closeUserItemsModal = () => {
    setUserItemsModalOpen(false)
    setSelectedUserForItems(null)
    setUserItemsData(null)
    setUserItemsError('')
  }

  const handleSaveDomesticShipping = async () => {
    if (editingDomesticUserId == null) return
    const amount = editingDomesticValue.trim()
      ? parseInt(editingDomesticValue.replace(/\D/g, ''), 10)
      : 0
    if (isNaN(amount) || amount < 0) {
      setError('กรุณาใส่จำนวนเงินที่ถูกต้อง')
      return
    }
    setDomesticSaving(true)
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/domestic-shipping-queue/${editingDomesticUserId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount_baht: amount }),
          credentials: 'include',
        }
      )
      const json = await res.json()
      if (json.success) {
        setDomesticQueueItems((prev) =>
          prev.map((item) =>
            item.userId === editingDomesticUserId ? { ...item, domesticPendingBaht: amount } : item
          )
        )
        cancelEditDomestic()
      } else {
        setError(json.error?.message ?? 'Failed to save domestic shipping')
      }
    } catch {
      setError('Network error')
    } finally {
      setDomesticSaving(false)
    }
  }

  const handleSaveWeightGram = async () => {
    if (editingWeightId == null) return
    const gram = editingWeightValue.trim() ? parseInt(editingWeightValue.replace(/\D/g, ''), 10) : null
    if (gram != null && (isNaN(gram) || gram < 0)) {
      setError('กรุณาใส่จำนวนกรัมที่ถูกต้อง')
      return
    }
    setWeightSaving(true)
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/auction-requests/${editingWeightId}/weight-gram`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ weight_gram: gram }),
          credentials: 'include',
        }
      )
      const json = await res.json()
      if (json.success) {
        setItems((prev) =>
          prev.map((item) =>
            item.id === editingWeightId ? { ...item, weight_gram: gram } : item
          )
        )
        cancelEditWeight()
      } else {
        setError(json.error?.message ?? 'Failed to save weight')
      }
    } catch {
      setError('Network error')
    } finally {
      setWeightSaving(false)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">
            การประมูลที่สิ้นสุดแล้ว
          </h1>
        </div>
        <span className="rounded-full bg-indigo-50 px-4 py-1.5 text-sm font-semibold text-indigo-700">
          {isArrivedThTab ? filteredDomestic.length : filtered.length} รายการ
        </span>
      </div>

      <div className="flex gap-1 mb-5 p-1 rounded-xl bg-sakura-100/80 border border-sakura-200/60 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
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

      <div className="mb-5 flex items-center justify-between gap-4 flex-wrap">
        <div className="relative w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            type="text"
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            placeholder={isArrivedThTab ? 'ค้นหาตาม User Name หรือ User ID...' : 'ค้นหาตามชื่อสินค้า, User Name หรือ User ID...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-card-border bg-white text-sm
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-shadow"
          />
        </div>
        <div className="flex flex-wrap gap-4 min-h-[72px]">
          {!isNotArrivedTab && !isArrivedThTab ? (
            <>
              <div className="rounded-xl border border-sakura-200 bg-sakura-50/80 px-5 py-3 min-w-[140px]">
                <p className="text-xs font-medium text-sakura-600 uppercase tracking-wider">ยอดรวมทั้งหมด</p>
                <p className="text-lg font-bold text-sakura-900 tabular-nums">¥{formatPrice(summaryTotal)}</p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 px-5 py-3 min-w-[140px]">
                <p className="text-xs font-medium text-emerald-600 uppercase tracking-wider">ชำระแล้ว</p>
                <p className="text-lg font-bold text-emerald-800 tabular-nums">¥{formatPrice(summaryPaid)}</p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-5 py-3 min-w-[140px]">
                <p className="text-xs font-medium text-amber-600 uppercase tracking-wider">ยอดค้างชำระ</p>
                <p className="text-lg font-bold text-amber-800 tabular-nums">¥{formatPrice(summaryOutstanding)}</p>
              </div>
            </>
          ) : (
            <span className="invisible" aria-hidden="true">.</span>
          )}
        </div>
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
                  {isArrivedThTab ? (
                    <>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                        User ID
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                        User Name
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                        จำนวนสินค้า
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                        Lot
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-44 whitespace-nowrap bg-teal-50">
                        ค่าจัดส่งในประเทศ
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                        User ID
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                        User Name
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-48">
                        Product
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                        Auction URL
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-40 whitespace-nowrap">
                        Current Bid
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-40 whitespace-nowrap">
                        Request Bid
                      </th>
                      {isShippingTab && (
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                          Lot
                        </th>
                      )}
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                        Note
                      </th>
                      {isNotArrivedTab && (
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap bg-purple-100">
                          กรัม
                        </th>
                      )}
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {isArrivedThTab ? (
                  filteredDomestic.map((item) => (
                    <tr
                      key={item.userId}
                      onClick={() => openUserItemsModal(item)}
                      className="border-b border-sakura-100 last:border-0 hover:bg-indigo-50/30 transition-colors cursor-pointer"
                    >
                      <td className="px-6 py-5 align-middle text-center w-36">
                        <span className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-medium text-sakura-800 max-w-full truncate">
                          {item.userCode ?? '-'}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-36">
                        <span className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-semibold text-sakura-800">
                          {item.username ?? '-'}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-36">
                        <span className="font-semibold tabular-nums text-sakura-900">
                          {item.pendingDomesticItemCount}
                        </span>
                      </td>
                      <td className="px-6 py-5 align-middle text-center w-40">
                        <span className="font-medium text-sakura-800">
                          {item.lots?.length
                            ? item.lots.map((l) => l.lotCode).join(', ')
                            : '-'}
                        </span>
                      </td>
                      <td
                        className="px-6 py-5 align-middle text-center w-44 bg-teal-50/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {editingDomesticUserId === item.userId ? (
                          <div className="flex flex-col gap-1.5 min-w-[110px]">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editingDomesticValue}
                              onChange={(e) =>
                                setEditingDomesticValue(e.target.value.replace(/\D/g, ''))
                              }
                              placeholder="บาท"
                              className="rounded-lg border border-sakura-200 px-2.5 py-1.5 text-xs w-24
                                         focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={handleSaveDomesticShipping}
                                disabled={domesticSaving}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-teal-600 px-2 py-1 text-xs font-medium text-white
                                           hover:bg-teal-700 disabled:opacity-50"
                              >
                                {domesticSaving ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                Save
                              </button>
                              <button
                                onClick={cancelEditDomestic}
                                className="rounded border border-sakura-200 px-2 py-1 text-xs font-medium text-sakura-600 hover:bg-sakura-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              startEditDomestic(item.userId, item.domesticPendingBaht)
                            }
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-teal-700 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                          >
                            <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                            <span className="tabular-nums font-semibold">
                              ฿{formatPrice(item.domesticPendingBaht)}
                            </span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-sakura-100 last:border-0 hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="px-6 py-5 align-middle text-center w-36">
                      <span
                        className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-medium text-sakura-800 max-w-full truncate"
                        title={item.externalId ?? undefined}
                      >
                        {item.externalId ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-36">
                      <span className="inline-flex items-center rounded-lg bg-sakura-100 px-2.5 py-1 font-mono text-xs font-semibold text-sakura-800">
                        {item.username ?? '-'}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle w-48">
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
                        <span className="font-medium text-sakura-900 line-clamp-2 max-w-[180px] leading-snug">
                          {item.title ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-40">
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
                    <td className="px-6 py-5 align-middle text-center w-40">
                      <div className="flex min-h-[56px] w-full items-center justify-center">
                        <span className="font-bold tabular-nums text-sakura-900 whitespace-nowrap">
                          ¥{formatPrice(item.currentPrice)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-40">
                      <div className="flex min-h-[56px] w-full items-center justify-center">
                        <span className="font-bold tabular-nums text-indigo-700 whitespace-nowrap">
                          ¥{formatPrice(item.lastBid?.price ?? 0)}
                        </span>
                      </div>
                    </td>
                    {isShippingTab && (
                      <td className="px-6 py-5 align-middle text-center w-40">
                        <span className="font-medium text-sakura-800">
                          {item.lot?.lot_code ?? '-'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-5 align-middle text-center w-40">
                      {editingNoteId === item.id ? (
                        <div className="flex flex-col gap-1.5 min-w-[140px]">
                          <textarea
                            value={editingNoteValue}
                            onChange={(e) =>
                              setEditingNoteValue(e.target.value.slice(0, 2000))
                            }
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
                              {noteSaving ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Check className="h-3 w-3" />
                              )}
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
                          <span className="line-clamp-2 max-w-[100px]">
                            {item.note?.trim() || 'Add note'}
                          </span>
                        </button>
                      )}
                    </td>
                    {isNotArrivedTab && (
                      <td className="px-6 py-5 align-middle text-center w-40 bg-purple-50">
                        {editingWeightId === item.id ? (
                          <div className="flex flex-col gap-1.5 min-w-[100px]">
                            <input
                              type="text"
                              inputMode="numeric"
                              value={editingWeightValue}
                              onChange={(e) =>
                                setEditingWeightValue(e.target.value.replace(/\D/g, ''))
                              }
                              placeholder="กรัม"
                              className="rounded-lg border border-sakura-200 px-2.5 py-1.5 text-xs w-20
                                         focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                              autoFocus
                            />
                            <div className="flex gap-1.5">
                              <button
                                onClick={handleSaveWeightGram}
                                disabled={weightSaving}
                                className="flex-1 inline-flex items-center justify-center gap-1 rounded bg-indigo-600 px-2 py-1 text-xs font-medium text-white
                                           hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {weightSaving ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                                Save
                              </button>
                              <button
                                onClick={cancelEditWeight}
                                className="rounded border border-sakura-200 px-2 py-1 text-xs font-medium text-sakura-600 hover:bg-sakura-50"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              startEditWeight(item.id, item.weight_gram ?? null)
                            }
                            className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-sakura-600 hover:bg-sakura-50 hover:text-sakura-800 transition-colors"
                          >
                            <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                            {item.weight_gram != null ? (
                              <span className="tabular-nums">{item.weight_gram} ก</span>
                            ) : (
                              'ใส่กรัม'
                            )}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))
                )}

                {isArrivedThTab && filteredDomestic.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-16 text-center align-middle">
                      <p className="text-sakura-500 font-medium">
                        {filterUser
                          ? `ไม่พบรายการสำหรับ "${filterUser}"`
                          : 'ไม่มีรายการในคิวจัดส่งในประเทศ'}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {filterUser ? 'ลองค้นหาด้วยคำอื่น' : 'รายการที่รอจัดส่งในประเทศจะแสดงที่นี่'}
                      </p>
                    </td>
                  </tr>
                )}
                {!isArrivedThTab && filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-6 py-16 text-center align-middle"
                    >
                      <p className="text-sakura-500 font-medium">
                        {filterUser
                          ? `ไม่พบรายการสำหรับ "${filterUser}"`
                          : 'ไม่มีรายการประมูลที่สิ้นสุดแล้ว'}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {filterUser
                          ? 'ลองค้นหาด้วยคำอื่น'
                          : 'รายการประมูลที่สิ้นสุดจะแสดงที่นี่'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {userItemsModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeUserItemsModal}
            aria-hidden="true"
          />
          <div
            className="relative z-10 w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl border border-card-border shadow-card flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-sakura-200 bg-sakura-50/80 shrink-0">
              <div>
                <h2 className="text-lg font-bold text-sakura-900">
                  รายการสินค้า — {selectedUserForItems?.username ?? selectedUserForItems?.userCode ?? '-'}
                </h2>
                <p className="text-sm text-muted mt-0.5">
                  User ID: {selectedUserForItems?.userCode ?? '-'} · จำนวน {userItemsData?.items?.length ?? selectedUserForItems?.pendingDomesticItemCount ?? 0} ชิ้น
                  {userItemsData != null && (
                    <span className="ml-2">
                      · ค่าจัดส่งในประเทศ ฿{formatPrice(userItemsData.domesticPendingBaht ?? 0)}
                    </span>
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={closeUserItemsModal}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900 transition-colors"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-6">
              {userItemsLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted" />
                </div>
              ) : userItemsError ? (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  {userItemsError}
                </div>
              ) : userItemsData ? (
                userItemsData.items?.length === 0 ? (
                  <p className="text-sakura-500 text-center py-8">ไม่มีรายการสินค้า</p>
                ) : (() => {
                  const byLot = (userItemsData.items ?? []).reduce<
                    Record<string, typeof userItemsData.items>
                  >((acc, it) => {
                    const key = it.lot?.lotCode ?? '__NO_LOT__'
                    if (!acc[key]) acc[key] = []
                    acc[key]!.push(it)
                    return acc
                  }, {})
                  const lotKeys = Object.keys(byLot).sort((a, b) =>
                    a === '__NO_LOT__' ? 1 : b === '__NO_LOT__' ? -1 : a.localeCompare(b)
                  )
                  const sectionBg = [
                    'bg-amber-50/80',
                    'bg-emerald-50/80',
                    'bg-sky-50/80',
                    'bg-violet-50/80',
                    'bg-rose-50/80',
                  ]
                  return (
                    <div className="space-y-6">
                      {lotKeys.map((lotKey, idx) => (
                        <section
                          key={lotKey}
                          className={`rounded-2xl p-5 ${sectionBg[idx % sectionBg.length]} border border-sakura-200/60`}
                        >
                          <h3 className="text-base font-bold text-sakura-900 mb-4 pb-2 border-b border-sakura-200/80 text-center">
                            {lotKey === '__NO_LOT__' ? 'ไม่มี Lot' : lotKey}
                          </h3>
                          <div className="space-y-3">
                            {byLot[lotKey]?.map((it) => (
                              <div
                                key={it.id}
                                className="flex gap-4 p-4 rounded-xl border border-sakura-200/60 bg-white/70 hover:bg-white transition-colors"
                              >
                                <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-sakura-100 ring-1 ring-sakura-200/50">
                                  {it.imageUrl ? (
                                    <Image
                                      src={it.imageUrl}
                                      alt={it.title ?? 'Product'}
                                      fill
                                      className="object-cover"
                                      sizes="64px"
                                    />
                                  ) : (
                                    <div className="h-full w-full flex items-center justify-center text-muted text-xs">—</div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sakura-900 line-clamp-2">{it.title ?? '-'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      ))}
                    </div>
                  )
                })()
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
