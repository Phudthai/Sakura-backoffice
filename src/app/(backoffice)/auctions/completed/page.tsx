'use client'

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import Image from 'next/image'
import { ExternalLink, Search, Loader2, Pencil, Check, X, Copy, Plus } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import BuyoutAddProductModal from '@/components/backoffice/buyout-add-product-modal'
import { createPortal } from 'react-dom'
import Swal from 'sweetalert2'

function computeBubblePosition(
  rect: DOMRect,
  approxHeight: number,
  maxWidth = 240
): { top: number; left: number; width: number } {
  const width = Math.min(maxWidth, window.innerWidth - 24)
  const margin = 12
  let left = rect.left
  if (left + width > window.innerWidth - margin) left = Math.max(margin, window.innerWidth - width - margin)
  if (left < margin) left = margin
  let top = rect.bottom + 8
  if (top + approxHeight > window.innerHeight - margin) {
    top = Math.max(margin, rect.top - approxHeight - 8)
  }
  if (top < margin) top = margin
  return { top, left, width }
}

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
  site_name?: string
  siteName?: string
  webName?: string
  web_name?: string
  intl_shipping_type?: string | null
  intlShippingType?: string | null
  /** ราคาเป็นบาท — จาก API */
  currentPriceBaht?: number | null
  current_price_baht?: number | null
  /** จาก PATCH note / intl-shipping-type ฯลฯ */
  deliveryStages?: unknown
}

function siteNameFromCompletedItem(item: AuctionRequest): string {
  const raw = item.webName ?? item.web_name ?? item.siteName ?? item.site_name
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (item.url) {
    try {
      return new URL(item.url).hostname.replace(/^www\./, '')
    } catch {
      return '—'
    }
  }
  return '—'
}

function priceBahtFromItem(item: AuctionRequest): number | null {
  const c = item.currentPriceBaht ?? item.current_price_baht
  if (typeof c === 'number' && Number.isFinite(c)) return c
  return null
}

function intlShippingTypeRaw(item: AuctionRequest): string | null {
  const r = item as unknown as Record<string, unknown>
  const v =
    item.intl_shipping_type ??
    item.intlShippingType ??
    (typeof r.intlShippingType === 'string' ? r.intlShippingType : null) ??
    (typeof r.intl_shipping_type === 'string' ? r.intl_shipping_type : null)
  if (v == null || String(v).trim() === '') return null
  return String(v).trim().toLowerCase()
}

function intlShippingTypeValue(item: AuctionRequest): '' | 'air' | 'sea' {
  const u = intlShippingTypeRaw(item)
  if (u === 'air') return 'air'
  if (u === 'sea') return 'sea'
  return ''
}

function intlShippingLabelTh(item: AuctionRequest): string {
  const u = intlShippingTypeRaw(item)
  if (u == null) return '—'
  if (u === 'air') return 'ทางอากาศ'
  if (u === 'sea') return 'ทางเรือ'
  return String(u)
}

function intlShippingSuffixForLot(
  lot: { intlShippingType?: string | null; intl_shipping_type?: string | null } | null | undefined
): 'air' | 'sea' | '' {
  if (!lot) return ''
  const raw = lot.intlShippingType ?? lot.intl_shipping_type
  if (raw == null || String(raw).trim() === '') return ''
  const u = String(raw).trim().toLowerCase()
  if (u === 'air' || u === 'sea') return u
  return ''
}

/** แสดง LOT1 (air) / LOT1 (sea) ให้แยกเมื่อ lotCode ซ้ำกันคนละช่องทาง */
function formatDomesticQueueLotDisplay(lot: {
  lotCode: string
  intlShippingType?: string | null
  intl_shipping_type?: string | null
}): string {
  const code = lot.lotCode ?? '-'
  const s = intlShippingSuffixForLot(lot)
  return s ? `${code} (${s})` : code
}

interface DomesticShippingQueueItem {
  userId: number
  userCode: string
  username: string
  pendingDomesticItemCount: number
  lots: {
    id: number
    lotCode: string
    intlShippingType?: string | null
    intl_shipping_type?: string | null
    isArrived?: boolean
    arriveAt?: string | null
  }[]
  domesticPendingBaht: number | null
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
  lot?: {
    id: number
    lotCode: string
    isArrived?: boolean
    arriveAt?: string | null
    intlShippingType?: string | null
    intl_shipping_type?: string | null
  } | null
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

/** จาก GET /api/backoffice/users?role=customer — ใช้ค้นหา + dropdown */
interface CustomerPick {
  id: number
  userCode: string | null
  username: string | null
  name: string
  email: string
}

function normalizeCustomerPick(raw: unknown): CustomerPick | null {
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
  return {
    id,
    userCode: typeof r.userCode === 'string' ? r.userCode : (r.user_code as string | null) ?? null,
    username: typeof r.username === 'string' ? r.username : (r.user_name as string | null) ?? null,
    email: typeof r.email === 'string' ? r.email : '',
    name,
  }
}

function customerPickMatchesQuery(c: CustomerPick, q: string): boolean {
  const tokens = q.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return false
  const fields = [c.userCode, c.username, c.name, c.email].map((s) => (s ?? '').toLowerCase())
  return tokens.every((token) => fields.some((f) => f.includes(token)))
}

type ActiveTab = 'not_arrived' | 'shipping' | 'arrived_th'
type ShippingTab = 'air' | 'sea'

const TABS: { id: ActiveTab; label: string }[] = [
  { id: 'not_arrived', label: 'สินค้าที่ยังไม่ถึงบ้านญี่ปุ่น' },
  { id: 'shipping', label: 'จัดส่ง' },
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
  filters: AuctionListFilters,
  shippingType: ShippingTab
): string {
  const params = new URLSearchParams()
  params.set('page', '1')
  params.set('limit', '20')
  params.set('status', 'completed')
  if (filters.purchaseMode === 'AUCTION' || filters.purchaseMode === 'BUYOUT') {
    params.set('purchase_mode', filters.purchaseMode)
  }
  if (tab === 'not_arrived') params.set('delivery_stage', '0')
  if (tab === 'shipping') {
    params.set('delivery_stage', '1')
    params.set('shipping_type', shippingType)
  }
  if (tab === 'shipping') {
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

/** ถ้า filter ตรงกับรหัสผู้ใช้ (externalId / userCode) ให้ใช้ชื่อผู้ใช้สำหรับ modal กดเว็ป */
function resolveBuyoutModalUsername(
  filterRaw: string,
  auctionItems: AuctionRequest[],
  domesticItems: DomesticShippingQueueItem[]
): string {
  const t = filterRaw.trim()
  if (!t) return ''
  const lower = t.toLowerCase()
  const matchAr = auctionItems.find(
    (it) => (it.externalId ?? '').toLowerCase() === lower
  )
  if (matchAr?.username?.trim()) return matchAr.username.trim()

  const matchDom = domesticItems.find(
    (it) => (it.userCode ?? '').toLowerCase() === lower
  )
  if (matchDom?.username?.trim()) return matchDom.username.trim()

  return t
}

function CompletedAuctionsPageContent() {
  const searchParams = useSearchParams()
  const usernameFromUrl = searchParams.get('username')

  const [activeTab, setActiveTab] = useState<ActiveTab>('not_arrived')
  const [shippingType, setShippingType] = useState<ShippingTab>('air')
  const [items, setItems] = useState<AuctionRequest[]>([])
  const [domesticQueueItems, setDomesticQueueItems] = useState<DomesticShippingQueueItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [customers, setCustomers] = useState<CustomerPick[]>([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerDdOpen, setCustomerDdOpen] = useState(false)
  const customerSearchBlurRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [notePopoverPos, setNotePopoverPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const [noteSaving, setNoteSaving] = useState(false)
  const [editingWeightId, setEditingWeightId] = useState<number | null>(null)
  const [editingWeightValue, setEditingWeightValue] = useState('')
  const [weightPopoverPos, setWeightPopoverPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const [weightSaving, setWeightSaving] = useState(false)
  const [intlShippingSavingId, setIntlShippingSavingId] = useState<number | null>(null)
  const [editingDomesticUserId, setEditingDomesticUserId] = useState<number | null>(null)
  const [editingDomesticValue, setEditingDomesticValue] = useState('')
  const [domesticPopoverPos, setDomesticPopoverPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
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
  const [addProductModalOpen, setAddProductModalOpen] = useState(false)
  /** snapshot ตอนกดเปิด modal — ให้ตรงกับ filter ชื่อลูกค้าตอนนั้น */
  const [addProductModalInitialUsername, setAddProductModalInitialUsername] =
    useState('')

  useEffect(() => {
    if (usernameFromUrl != null && usernameFromUrl !== '') {
      try {
        setFilterUser(decodeURIComponent(usernameFromUrl))
      } catch {
        setFilterUser(usernameFromUrl)
      }
    }
  }, [usernameFromUrl])

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true)
    try {
      const qs = new URLSearchParams({ role: 'customer' })
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/users?${qs}`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && Array.isArray(json.data)) {
        const rows = json.data
          .map(normalizeCustomerPick)
          .filter((c: CustomerPick | null): c is CustomerPick => c != null)
        setCustomers(rows)
      } else {
        setCustomers([])
      }
    } catch {
      setCustomers([])
    } finally {
      setLoadingCustomers(false)
    }
  }, [])

  useEffect(() => {
    void fetchCustomers()
  }, [fetchCustomers])

  useEffect(() => {
    return () => {
      if (customerSearchBlurRef.current != null) {
        clearTimeout(customerSearchBlurRef.current)
      }
    }
  }, [])

  const customerSuggestions = useMemo(() => {
    const q = filterUser.trim()
    if (!q) return []
    return customers.filter((c) => customerPickMatchesQuery(c, q)).slice(0, 40)
  }, [customers, filterUser])

  const isNotArrivedTab = activeTab === 'not_arrived'
  const isShippingTab = activeTab === 'shipping'
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
    if (activeTab !== 'shipping') return
    const shipTab = shippingType
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
  }, [activeTab, shippingType])

  /** ถ้าเลือก lot ที่ไม่มีในรายการหลังโหลด — เคลียร์ */
  useEffect(() => {
    if (activeTab !== 'shipping') return
    const tab = shippingType
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
  }, [activeTab, shippingType, shippingLotsByTab])

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
        const lotStr = activeTab === 'shipping' ? debouncedLotByTab[shippingType] : ''
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
        }, shippingType)
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
    shippingType,
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

  const startEditNote = (itemId: number, currentNote: string | null, anchorRect: DOMRect) => {
    setEditingDomesticUserId(null)
    setEditingDomesticValue('')
    setDomesticPopoverPos(null)
    setEditingWeightId(null)
    setEditingWeightValue('')
    setWeightPopoverPos(null)
    setEditingNoteId(itemId)
    setEditingNoteValue(currentNote ?? '')
    setNotePopoverPos(computeBubblePosition(anchorRect, 168))
  }

  const cancelEditNote = () => {
    setEditingNoteId(null)
    setEditingNoteValue('')
    setNotePopoverPos(null)
  }

  const startEditWeight = (itemId: number, currentWeight: number | null, anchorRect: DOMRect) => {
    setEditingDomesticUserId(null)
    setEditingDomesticValue('')
    setDomesticPopoverPos(null)
    setEditingNoteId(null)
    setEditingNoteValue('')
    setNotePopoverPos(null)
    setEditingWeightId(itemId)
    setEditingWeightValue(currentWeight != null ? String(currentWeight) : '')
    setWeightPopoverPos(computeBubblePosition(anchorRect, 200, 220))
  }

  const cancelEditWeight = () => {
    setEditingWeightId(null)
    setEditingWeightValue('')
    setWeightPopoverPos(null)
  }

  useEffect(() => {
    if (editingNoteId == null && editingWeightId == null && editingDomesticUserId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setEditingNoteId(null)
      setEditingNoteValue('')
      setNotePopoverPos(null)
      setEditingWeightId(null)
      setEditingWeightValue('')
      setWeightPopoverPos(null)
      setEditingDomesticUserId(null)
      setEditingDomesticValue('')
      setDomesticPopoverPos(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingNoteId, editingWeightId, editingDomesticUserId])

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

  const startEditDomestic = (userId: number, currentAmount: number | null, anchorRect: DOMRect) => {
    setEditingNoteId(null)
    setEditingNoteValue('')
    setNotePopoverPos(null)
    setEditingWeightId(null)
    setEditingWeightValue('')
    setWeightPopoverPos(null)
    setEditingDomesticUserId(userId)
    setEditingDomesticValue(currentAmount != null ? String(currentAmount) : '')
    setDomesticPopoverPos(computeBubblePosition(anchorRect, 200, 240))
  }

  const cancelEditDomestic = () => {
    setEditingDomesticUserId(null)
    setEditingDomesticValue('')
    setDomesticPopoverPos(null)
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
        // แท็บยังไม่ถึงญี่ปุ่น: พอใส่กรัมแล้วรายการจะไปแท็บจัดส่งหลังรีเฟรช — เอาออกจากรายการทันที
        if (isNotArrivedTab && gram != null) {
          setItems((prev) => prev.filter((item) => item.id !== editingWeightId))
        } else {
          setItems((prev) =>
            prev.map((item) =>
              item.id === editingWeightId ? { ...item, weight_gram: gram } : item
            )
          )
        }
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

  const patchIntlShippingType = async (itemId: number, intl_shipping_type: 'air' | 'sea') => {
    setIntlShippingSavingId(itemId)
    setError('')
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/purchase-requests/${itemId}/intl-shipping-type`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ intl_shipping_type }),
        }
      )
      const json = await res.json()
      if (!res.ok) {
        if (res.status === 409) {
          setError(
            json.error?.message ??
              'ใส่กรัมแล้ว ไม่สามารถเปลี่ยนวิธีส่งได้ (WEIGHT_GRAM_ALREADY_SET)'
          )
        } else {
          setError(json.error?.message ?? 'ไม่สามารถอัปเดตวิธีส่งได้')
        }
        return
      }
      if (json.success && json.data != null && typeof json.data === 'object') {
        setItems((prev) =>
          prev.map((it) =>
            it.id === itemId ? { ...it, ...(json.data as Partial<AuctionRequest>) } : it
          )
        )
      }
    } catch {
      setError('Network error')
    } finally {
      setIntlShippingSavingId(null)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">
            การจัดการสินค้า
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
        <div
          className={`mb-4 flex flex-wrap items-end gap-4 ${
            !isShippingTab ? 'justify-between' : ''
          }`}
        >
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
          {!isShippingTab && (
            <button
              type="button"
              onClick={() => {
                setAddProductModalInitialUsername(
                  resolveBuyoutModalUsername(
                    filterUser,
                    items,
                    domesticQueueItems
                  )
                )
                setAddProductModalOpen(true)
              }}
              className="btn-gradient inline-flex items-center justify-center gap-2 px-5 py-2.5 shrink-0 self-end"
            >
              <Plus className="h-4 w-4" />
              เพิ่มสินค้า
            </button>
          )}
        </div>
      )}

      {isShippingTab && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-sakura-200/80 bg-white px-4 py-3 shadow-sm">
          {/* Air / Sea pill toggle */}
          <div className="flex items-center gap-0.5 rounded-lg bg-sakura-100/80 p-0.5">
            {(['air', 'sea'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setShippingType(type)}
                className={`flex items-center gap-1.5 rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
                  shippingType === type
                    ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-sakura-200/60'
                    : 'text-sakura-500 hover:text-sakura-800'
                }`}
              >
                {type === 'air' ? '✈ Air' : '🚢 Sea'}
              </button>
            ))}
          </div>

          <div className="h-6 w-px bg-sakura-200" />

          {/* Lot */}
          <select
            value={lotIdByTab[shippingType]}
            onChange={(e) =>
              setLotIdByTab((prev) => ({ ...prev, [shippingType]: e.target.value }))
            }
            disabled={loadingShippingLots}
            className="rounded-lg border border-card-border px-3 py-1.5 text-sm text-sakura-900 min-w-[9rem]
                       focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:opacity-60"
          >
            <option value="">Lot ทั้งหมด</option>
            {shippingLotsByTab[shippingType].map((lot) => (
              <option key={lot.id} value={String(lot.id)}>
                {lot.lot_code}
              </option>
            ))}
          </select>

          <div className="h-6 w-px bg-sakura-200" />

          {/* Checkboxes */}
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={intlOutstanding}
              onChange={(e) => setIntlOutstanding(e.target.checked)}
              className="h-4 w-4 rounded border-sakura-300 text-indigo-600"
            />
            <span className="text-sm text-sakura-800">ค้าง intl</span>
          </label>
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={overduePayment}
              onChange={(e) => setOverduePayment(e.target.checked)}
              className="h-4 w-4 rounded border-sakura-300 text-indigo-600"
            />
            <span className="text-sm text-sakura-800">เลยกำหนดชำระ</span>
          </label>

          {/* Info tooltip */}
          <span
            title={
              'ค้าง intl = สินค้าเต็ม + ขนส่งต่างประเทศยังค้างอยู่\n' +
              'เลยกำหนดชำระ = Bangkok pickup เลยกำหนด และยังค้าง intl\n' +
              'เมื่อเปิดฟิลเตอร์ค้างจ่าย จะขอรายชื่อลูกค้าใน meta อัตโนมัติ'
            }
            className="ml-auto cursor-help text-sakura-400 hover:text-sakura-600 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </span>
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
        <div className="relative w-full max-w-md min-w-[18rem]">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none z-[1]" />
          {loadingCustomers && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted pointer-events-none z-[1]" />
          )}
          <input
            type="text"
            autoComplete="off"
            value={filterUser}
            onChange={(e) => {
              setFilterUser(e.target.value)
              setCustomerDdOpen(true)
            }}
            onFocus={() => setCustomerDdOpen(true)}
            onBlur={() => {
              if (customerSearchBlurRef.current != null) {
                clearTimeout(customerSearchBlurRef.current)
              }
              customerSearchBlurRef.current = setTimeout(() => setCustomerDdOpen(false), 200)
            }}
            placeholder={
              isArrivedThTab
                ? 'พิมพ์เพื่อเลือกลูกค้าหรือค้นหา User…'
                : 'พิมพ์เพื่อเลือกลูกค้า หรือค้นหาสินค้า / User…'
            }
            className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-card-border bg-white text-sm
                       placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 transition-shadow"
            aria-expanded={Boolean(
              customerDdOpen && filterUser.trim().length > 0 && customerSuggestions.length > 0
            )}
            aria-controls="completed-customer-suggest"
            aria-autocomplete="list"
          />
          {customerDdOpen &&
            filterUser.trim().length > 0 &&
            customerSuggestions.length > 0 && (
              <ul
                id="completed-customer-suggest"
                role="listbox"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-xl border border-card-border bg-white py-1 shadow-lg"
              >
                {customerSuggestions.map((c) => {
                  const line1 = c.name
                  const line2 = [c.userCode, c.username, c.email].filter(Boolean).join(' · ')
                  return (
                    <li key={c.id} role="option">
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-sakura-50 transition-colors"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          const v =
                            c.username?.trim() || c.userCode?.trim() || c.name.trim() || ''
                          setFilterUser(v)
                          setCustomerDdOpen(false)
                        }}
                      >
                        <span className="font-medium text-sakura-900 block truncate">{line1}</span>
                        {line2 ? (
                          <span className="text-xs text-muted-dark block truncate font-mono">{line2}</span>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
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
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">
                        ลิงก์
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center min-w-[7rem] max-w-[10rem]">
                        ชื่อเว็ป
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-40 whitespace-nowrap">
                        ราคา(เยน)
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-40 whitespace-nowrap">
                        ราคา(บาท)
                      </th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-32 whitespace-nowrap">
                        วิธีส่ง
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
                            ? item.lots.map((l) => formatDomesticQueueLotDisplay(l)).join(', ')
                            : '-'}
                        </span>
                      </td>
                      <td
                        className="px-6 py-5 align-middle text-center w-44 bg-teal-50/40"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={(e) =>
                            startEditDomestic(
                              item.userId,
                              item.domesticPendingBaht,
                              e.currentTarget.getBoundingClientRect()
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-teal-700 hover:bg-teal-50 hover:text-teal-900 transition-colors"
                        >
                          <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                          <span className="tabular-nums font-semibold">
                            ฿{formatPrice(item.domesticPendingBaht)}
                          </span>
                        </button>
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
                    <td className="px-6 py-5 align-middle text-center max-w-[10rem]">
                      <span
                        className="text-sm text-sakura-800 line-clamp-2 break-words"
                        title={siteNameFromCompletedItem(item)}
                      >
                        {siteNameFromCompletedItem(item)}
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
                        {(() => {
                          const baht = priceBahtFromItem(item)
                          return baht != null ? (
                            <span className="font-bold tabular-nums text-indigo-700 whitespace-nowrap">
                              ฿{formatPrice(baht)}
                            </span>
                          ) : (
                            <span className="text-muted">—</span>
                          )
                        })()}
                      </div>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-32">
                      {isNotArrivedTab && item.weight_gram == null ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <select
                            aria-label="วิธีส่ง"
                            value={intlShippingTypeValue(item)}
                            onChange={async (e) => {
                              const v = e.target.value
                              if (v !== 'air' && v !== 'sea') return
                              const prev = intlShippingTypeValue(item)
                              if (v === prev) return
                              const label = v === 'air' ? 'ทางอากาศ' : 'ทางเรือ'
                              const { isConfirmed } = await Swal.fire({
                                title: prev === '' ? 'ตั้งวิธีส่ง' : 'เปลี่ยนวิธีส่ง',
                                text:
                                  prev === ''
                                    ? `ต้องการตั้งวิธีส่งเป็น "${label}" หรือไม่?`
                                    : `ต้องการเปลี่ยนวิธีส่งเป็น "${label}" หรือไม่`,
                                icon: 'question',
                                showCancelButton: true,
                                confirmButtonText: 'ยืนยัน',
                                cancelButtonText: 'ยกเลิก',
                              })
                              if (!isConfirmed) return
                              void patchIntlShippingType(item.id, v)
                            }}
                            disabled={intlShippingSavingId === item.id}
                            className="max-w-[9rem] rounded-lg border border-sakura-200 bg-white px-2 py-1.5 text-xs text-sakura-800
                                       focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300 disabled:opacity-60"
                          >
                            <option value="" disabled hidden>
                              {'\u200b'}
                            </option>
                            <option value="air">ทางอากาศ</option>
                            <option value="sea">ทางเรือ</option>
                          </select>
                          {intlShippingSavingId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-indigo-600" aria-hidden />
                          ) : null}
                        </div>
                      ) : (
                        <span className="text-sm text-sakura-800 whitespace-nowrap">
                          {intlShippingLabelTh(item)}
                        </span>
                      )}
                    </td>
                    {isShippingTab && (
                      <td className="px-6 py-5 align-middle text-center w-40">
                        <span className="font-medium text-sakura-800">
                          {item.lot?.lot_code ?? '-'}
                        </span>
                      </td>
                    )}
                    <td className="px-6 py-5 align-middle text-center w-40">
                      <button
                        type="button"
                        onClick={(e) =>
                          startEditNote(item.id, item.note ?? null, e.currentTarget.getBoundingClientRect())
                        }
                        className="inline-flex max-w-full items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-sakura-600 hover:bg-sakura-50 hover:text-sakura-800 transition-colors text-left min-h-[32px] min-w-0"
                      >
                        <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                        <span className="line-clamp-2 max-w-[100px]">
                          {item.note?.trim() || 'เพิ่มหมายเหตุ'}
                        </span>
                      </button>
                    </td>
                    {isNotArrivedTab && (
                      <td className="px-6 py-5 align-middle text-center w-40 bg-purple-50">
                        <button
                          type="button"
                          onClick={(e) =>
                            startEditWeight(
                              item.id,
                              item.weight_gram ?? null,
                              e.currentTarget.getBoundingClientRect()
                            )
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
                      colSpan={10}
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
                  const lotGroupKey = (it: (typeof userItemsData.items)[number]) => {
                    const lc = it.lot?.lotCode
                    if (!lc) return '__NO_LOT__'
                    const s = intlShippingSuffixForLot(it.lot ?? null)
                    return s ? `${lc}__${s}` : lc
                  }
                  const lotGroupTitle = (key: string) => {
                    if (key === '__NO_LOT__') return 'ไม่มี Lot'
                    const parts = key.split('__')
                    if (parts.length === 2 && (parts[1] === 'air' || parts[1] === 'sea')) {
                      return `${parts[0]} (${parts[1]})`
                    }
                    return key
                  }
                  const byLot = (userItemsData.items ?? []).reduce<
                    Record<string, typeof userItemsData.items>
                  >((acc, it) => {
                    const key = lotGroupKey(it)
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
                            {lotGroupTitle(lotKey)}
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

      {editingNoteId != null &&
        notePopoverPos != null &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200] bg-sakura-950/25"
              aria-hidden
              onClick={() => cancelEditNote()}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="completed-note-popover-title"
              className="fixed z-[210] flex max-h-[min(300px,calc(100vh-24px))] flex-col rounded-xl border border-sakura-200/90 bg-white p-3 shadow-lg ring-1 ring-black/5"
              style={{
                top: notePopoverPos.top,
                left: notePopoverPos.left,
                width: notePopoverPos.width,
                maxWidth: 'min(240px, calc(100vw - 24px))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p id="completed-note-popover-title" className="text-xs font-semibold text-sakura-900 mb-1.5">
                แก้ไขหมายเหตุ
              </p>
              <textarea
                value={editingNoteValue}
                onChange={(e) => setEditingNoteValue(e.target.value.slice(0, 2000))}
                placeholder="พิมพ์หมายเหตุ..."
                rows={4}
                maxLength={2000}
                className="w-full min-h-[72px] flex-1 rounded-lg border border-sakura-200 px-2 py-1.5 text-xs resize-y
                           focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                autoFocus
              />
              <p className="text-[10px] text-muted mt-1 mb-2 tabular-nums">
                {editingNoteValue.length} / 2000
              </p>
              <div className="flex gap-1.5 justify-end border-t border-sakura-100 pt-2">
                <button
                  type="button"
                  onClick={() => cancelEditNote()}
                  className="rounded-lg border border-sakura-200 px-2 py-1 text-[11px] font-medium text-sakura-700 hover:bg-sakura-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void saveNote()}
                  disabled={noteSaving}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {noteSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  บันทึก
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      {editingWeightId != null &&
        weightPopoverPos != null &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200] bg-sakura-950/25"
              aria-hidden
              onClick={() => cancelEditWeight()}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="completed-weight-popover-title"
              className="fixed z-[210] flex max-h-[min(260px,calc(100vh-24px))] flex-col rounded-xl border border-sakura-200/90 bg-white p-3 shadow-lg ring-1 ring-black/5"
              style={{
                top: weightPopoverPos.top,
                left: weightPopoverPos.left,
                width: weightPopoverPos.width,
                maxWidth: 'min(220px, calc(100vw - 24px))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p id="completed-weight-popover-title" className="text-xs font-semibold text-sakura-900 mb-1.5">
                ใส่น้ำหนัก (กรัม)
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={editingWeightValue}
                onChange={(e) => setEditingWeightValue(e.target.value.replace(/\D/g, ''))}
                placeholder="กรัม"
                className="w-full rounded-lg border border-sakura-200 px-2 py-1.5 text-xs tabular-nums
                           focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end border-t border-sakura-100 pt-2 mt-3">
                <button
                  type="button"
                  onClick={() => cancelEditWeight()}
                  className="rounded-lg border border-sakura-200 px-2 py-1 text-[11px] font-medium text-sakura-700 hover:bg-sakura-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveWeightGram()}
                  disabled={weightSaving}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {weightSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  บันทึก
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      {editingDomesticUserId != null &&
        domesticPopoverPos != null &&
        createPortal(
          <>
            <div
              className="fixed inset-0 z-[200] bg-sakura-950/25"
              aria-hidden
              onClick={() => cancelEditDomestic()}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="completed-domestic-popover-title"
              className="fixed z-[210] flex max-h-[min(260px,calc(100vh-24px))] flex-col rounded-xl border border-teal-200/90 bg-white p-3 shadow-lg ring-1 ring-black/5"
              style={{
                top: domesticPopoverPos.top,
                left: domesticPopoverPos.left,
                width: domesticPopoverPos.width,
                maxWidth: 'min(240px, calc(100vw - 24px))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p id="completed-domestic-popover-title" className="text-xs font-semibold text-sakura-900 mb-1.5">
                ค่าจัดส่งในประเทศ (บาท)
              </p>
              <input
                type="text"
                inputMode="numeric"
                value={editingDomesticValue}
                onChange={(e) => setEditingDomesticValue(e.target.value.replace(/\D/g, ''))}
                placeholder="บาท"
                className="w-full rounded-lg border border-sakura-200 px-2 py-1.5 text-xs tabular-nums
                           focus:outline-none focus:ring-2 focus:ring-teal-200 focus:border-teal-300"
                autoFocus
              />
              <div className="flex gap-1.5 justify-end border-t border-sakura-100 pt-2 mt-3">
                <button
                  type="button"
                  onClick={() => cancelEditDomestic()}
                  className="rounded-lg border border-sakura-200 px-2 py-1 text-[11px] font-medium text-sakura-700 hover:bg-sakura-50"
                >
                  ยกเลิก
                </button>
                <button
                  type="button"
                  onClick={() => void handleSaveDomesticShipping()}
                  disabled={domesticSaving}
                  className="inline-flex items-center justify-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {domesticSaving ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Check className="h-3 w-3" />
                  )}
                  บันทึก
                </button>
              </div>
            </div>
          </>,
          document.body
        )}

      <BuyoutAddProductModal
        open={addProductModalOpen}
        onClose={() => setAddProductModalOpen(false)}
        onSuccess={() => void fetchData()}
        initialUsername={addProductModalInitialUsername}
        clientEntry="not_arrived_japan"
      />
    </div>
  )
}

export default function CompletedAuctionsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-muted">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <CompletedAuctionsPageContent />
    </Suspense>
  )
}
