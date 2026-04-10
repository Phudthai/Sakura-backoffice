'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { purchaseModeLabelTh } from '@/lib/purchase-mode-label'
import Image from 'next/image'
import { ExternalLink, Search, Loader2, Pencil, Check, X, Copy } from 'lucide-react'
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
  purchaseMode?: string
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

/** Lot สำหรับ dropdown ฟิลเตอร์ — จาก GET /lots/grouped-by-shipping-type?shipping_type=&pending_domestic_shipping=true */
interface ShippingLotOption {
  id: number
  lot_code: string
}

type ActiveTab = 'not_arrived' | 'air' | 'sea' | 'arrived_th'
type ShippingTab = 'air' | 'sea'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'not_arrived', label: 'สินค้าที่ยังไม่ถึงบ้านญี่ปุ่น' },
  { id: 'air', label: 'จัดส่ง air' },
  { id: 'sea', label: 'จัดส่ง sea' },
  { id: 'arrived_th', label: 'สินค้าที่ถึงไทยแล้ว' },
]

type AuctionListFilters = {
  lotId?: number
  intlOutstanding: boolean
  overduePayment: boolean
  /** ไม่ส่ง query = ทั้ง AUCTION และ BUYOUT */
  purchaseMode?: 'AUCTION' | 'BUYOUT'
}

/** Builds GET /api/backoffice/purchase-requests query (combines with tab: status, delivery_stage, shipping_type). */
function buildAuctionQuery(
  tab: Exclude<ActiveTab, 'arrived_th'>,
  filters: AuctionListFilters
): string {
  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('limit', '20')
  params.set('status', 'completed')
  if (filters.purchaseMode === 'AUCTION' || filters.purchaseMode === 'BUYOUT') {
    params.set('purchase_mode', filters.purchaseMode)
  }
  if (tab === 'not_arrived') params.set('delivery_stage', '0')
  if (tab === 'air') {
    params.set('delivery_stage', '1')
    params.set('shipping_type', 'air')
  }
  if (tab === 'sea') {
    params.set('delivery_stage', '1')
    params.set('shipping_type', 'sea')
  }
  if (tab === 'air' || tab === 'sea') {
    if (filters.lotId != null && !Number.isNaN(filters.lotId)) {
      params.set('lot_id', String(filters.lotId))
    }
    if (filters.intlOutstanding) {
      params.set('intl_outstanding', 'true')
    }
    if (filters.overduePayment) {
      params.set('overdue_payment', 'true')
    }
    if (filters.intlOutstanding || filters.overduePayment) {
      params.set('include_unpaid_customer_copy', 'true')
    }
  }
  return params.toString()
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
  /** กรอง lot แยกแท็บจัดส่ง air / sea — ค่าเป็นสตริง id หรือ '' */
  const [lotIdByTab, setLotIdByTab] = useState<Record<ShippingTab, string>>({
    air: '',
    sea: '',
  })
  /** debounce ก่อนส่ง lot_id ไป purchase-requests */
  const [debouncedLotByTab, setDebouncedLotByTab] = useState<Record<ShippingTab, string>>({
    air: '',
    sea: '',
  })
  const [shippingLotsByTab, setShippingLotsByTab] = useState<{
    air: ShippingLotOption[]
    sea: ShippingLotOption[]
  }>({ air: [], sea: [] })
  const [loadingShippingLots, setLoadingShippingLots] = useState(false)
  const [intlOutstanding, setIntlOutstanding] = useState(false)
  const [overduePayment, setOverduePayment] = useState(false)
  const [unpaidCustomerCopy, setUnpaidCustomerCopy] = useState<string | null>(null)
  const [purchaseModeFilter, setPurchaseModeFilter] = useState<
    '' | 'AUCTION' | 'BUYOUT'
  >('')

  const isNotArrivedTab = activeTab === 'not_arrived'
  const isShippingTab = activeTab === 'air' || activeTab === 'sea'
  const isArrivedThTab = activeTab === 'arrived_th'

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedLotByTab((prev) => ({ ...prev, air: lotIdByTab.air })),
      350
    )
    return () => clearTimeout(t)
  }, [lotIdByTab.air])

  useEffect(() => {
    const t = setTimeout(
      () => setDebouncedLotByTab((prev) => ({ ...prev, sea: lotIdByTab.sea })),
      350
    )
    return () => clearTimeout(t)
  }, [lotIdByTab.sea])

  useEffect(() => {
    if (activeTab !== 'air' && activeTab !== 'sea') return
    const shipTab = activeTab
    let cancelled = false
    setLoadingShippingLots(true)
    void (async () => {
      try {
        const groupedParams = new URLSearchParams()
        groupedParams.set('shipping_type', shipTab)
        groupedParams.set('pending_domestic_shipping', 'true')
        const res = await fetch(
          `${API_BACKOFFICE_PREFIX}/lots/grouped-by-shipping-type?${groupedParams.toString()}`,
          { credentials: 'include' }
        )
        const json = await res.json()
        if (cancelled) return
        if (json.success && json.data) {
          const raw: unknown[] =
            shipTab === 'air' ? json.data.air ?? [] : json.data.sea ?? []
          const list: ShippingLotOption[] = raw.map((row) => {
            const r = row as { id: number; lot_code: string }
            return { id: r.id, lot_code: r.lot_code }
          })
          setShippingLotsByTab((prev) => ({ ...prev, [shipTab]: list }))
        } else {
          setShippingLotsByTab((prev) => ({ ...prev, [shipTab]: [] }))
        }
      } catch {
        if (!cancelled) {
          setShippingLotsByTab((prev) => ({ ...prev, [shipTab]: [] }))
        }
      } finally {
        if (!cancelled) setLoadingShippingLots(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [activeTab])

  /** ถ้าเลือก lot ที่ไม่มีในรายการหลังโหลด — เคลียร์ */
  useEffect(() => {
    if (activeTab !== 'air' && activeTab !== 'sea') return
    const tab = activeTab
    const list = shippingLotsByTab[tab]
    if (list.length === 0) return
    setLotIdByTab((prev) => {
      const idStr = prev[tab]
      if (!idStr) return prev
      const id = parseInt(idStr, 10)
      if (Number.isNaN(id)) return prev
      if (list.some((l) => l.id === id)) return prev
      return { ...prev, [tab]: '' }
    })
  }, [activeTab, shippingLotsByTab])

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      if (activeTab === 'arrived_th') {
        setUnpaidCustomerCopy(null)
        const res = await fetch(
          `${API_BACKOFFICE_PREFIX}/domestic-shipping-queue?page=1&limit=20`,
          { credentials: 'include' }
        )
        const json = await res.json()
        if (json.success) setDomesticQueueItems(json.data ?? [])
        else setError(json.error?.message ?? 'Failed to load domestic shipping queue')
      } else {
        const lotStr =
          activeTab === 'air'
            ? debouncedLotByTab.air
            : activeTab === 'sea'
              ? debouncedLotByTab.sea
              : ''
        const lotNum = lotStr.trim()
          ? parseInt(lotStr.replace(/\D/g, ''), 10)
          : NaN
        const query = buildAuctionQuery(activeTab, {
          lotId: !Number.isNaN(lotNum) ? lotNum : undefined,
          intlOutstanding,
          overduePayment,
          purchaseMode:
            purchaseModeFilter === 'AUCTION' || purchaseModeFilter === 'BUYOUT'
              ? purchaseModeFilter
              : undefined,
        })
        const arRes = await fetch(
          `${API_BACKOFFICE_PREFIX}/purchase-requests?${query}`,
          { credentials: 'include' }
        )
        const arJson = await arRes.json()
        if (arJson.success) {
          setItems(arJson.data ?? [])
          const meta = arJson.meta as { unpaidCustomerCopy?: string } | undefined
          setUnpaidCustomerCopy(
            typeof meta?.unpaidCustomerCopy === 'string' ? meta.unpaidCustomerCopy : null
          )
        } else {
          setUnpaidCustomerCopy(null)
          setError(arJson.error?.message ?? 'Failed to load completed auctions')
        }
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [
    activeTab,
    debouncedLotByTab.air,
    debouncedLotByTab.sea,
    intlOutstanding,
    overduePayment,
    purchaseModeFilter,
  ])

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
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/purchase-requests/${editingNoteId}/note`, {
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
        `${API_BACKOFFICE_PREFIX}/purchase-requests/${editingWeightId}/weight-gram`,
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

      {!isArrivedThTab && (
        <div className="mb-4 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-sakura-600 mb-1">
              โหมดการซื้อ
            </label>
            <select
              value={purchaseModeFilter}
              onChange={(e) =>
                setPurchaseModeFilter(e.target.value as '' | 'AUCTION' | 'BUYOUT')
              }
              className="min-w-[12rem] rounded-lg border border-card-border px-3 py-2 text-sm text-sakura-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">ทั้งหมด (ประมูล + กดเว็ป)</option>
              <option value="AUCTION">ประมูล</option>
              <option value="BUYOUT">กดเว็ป</option>
            </select>
          </div>
        </div>
      )}

      {isShippingTab && (
        <div className="mb-4 flex flex-wrap items-end gap-4 rounded-xl border border-sakura-200/80 bg-white p-4 shadow-sm">
          <div>
            <label className="block text-xs font-medium text-sakura-600 mb-1">
              Lot {activeTab === 'air' ? '(Air)' : '(Sea)'}
            </label>
            <select
              value={lotIdByTab[activeTab as ShippingTab]}
              onChange={(e) =>
                setLotIdByTab((prev) => ({
                  ...prev,
                  [activeTab as ShippingTab]: e.target.value,
                }))
              }
              disabled={loadingShippingLots}
              className="min-w-[10rem] max-w-xs rounded-lg border border-card-border px-3 py-2 text-sm text-sakura-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
            >
              <option value="">ทั้งหมด</option>
              {shippingLotsByTab[activeTab as ShippingTab].map((lot) => (
                <option key={lot.id} value={String(lot.id)}>
                  {lot.lot_code}
                </option>
              ))}
            </select>
          </div>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={intlOutstanding}
              onChange={(e) => setIntlOutstanding(e.target.checked)}
              className="h-4 w-4 rounded border-sakura-300 text-indigo-600"
            />
            <span className="text-sm text-sakura-800">ค้าง intl (สินค้าเต็ม + ขนส่งต่างประเทศ)</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overduePayment}
              onChange={(e) => setOverduePayment(e.target.checked)}
              className="h-4 w-4 rounded border-sakura-300 text-indigo-600"
            />
            <span className="text-sm text-sakura-800">เลยกำหนดชำระ (Bangkok) และยังค้าง intl</span>
          </label>
          <p className="text-xs text-muted max-w-xs">
            เมื่อเปิดฟิลเตอร์ค้างจ่าย จะขอรายชื่อลูกค้าใน meta อัตโนมัติ (ครบทั้งชุดที่ผ่านฟิลเตอร์)
          </p>
        </div>
      )}

      {isShippingTab && unpaidCustomerCopy != null && unpaidCustomerCopy !== '' && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/90 p-4">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-sm font-semibold text-amber-900">รายชื่อลูกค้า (user_code, comma-separated)</p>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(unpaidCustomerCopy)
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700"
            >
              <Copy className="h-3.5 w-3.5" />
              คัดลอก
            </button>
          </div>
          <p className="text-sm text-amber-950/90 break-all font-mono">{unpaidCustomerCopy}</p>
        </div>
      )}

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
                        รหัสผู้ใช้
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                        ชื่อผู้ใช้
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                        จำนวนสินค้า
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                        ล็อต
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-44 whitespace-nowrap bg-teal-50">
                        ค่าจัดส่งในประเทศ
                      </th>
                    </>
                  ) : (
                    <>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                        รหัสผู้ใช้
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">
                        ชื่อผู้ใช้
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-48">
                        สินค้า
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                        ลิงก์ประมูล
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-28 whitespace-nowrap">
                        โหมด
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-40 whitespace-nowrap">
                        ราคาปัจจุบัน
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-40 whitespace-nowrap">
                        ราคาที่ขอ
                      </th>
                      {isShippingTab && (
                        <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                          ล็อต
                        </th>
                      )}
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-40 whitespace-nowrap">
                        หมายเหตุ
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
                    <td className="px-6 py-5 align-middle text-center w-28">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {purchaseModeLabelTh(item.purchaseMode)}
                      </span>
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
                      colSpan={9}
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
                  รหัสผู้ใช้: {selectedUserForItems?.userCode ?? '-'} · จำนวน {userItemsData?.items?.length ?? selectedUserForItems?.pendingDomesticItemCount ?? 0} ชิ้น
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
