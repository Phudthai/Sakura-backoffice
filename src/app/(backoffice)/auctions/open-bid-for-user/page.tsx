'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { purchaseModeLabelTh } from '@/lib/purchase-mode-label'
import {
  submitAuctionFirstFlow,
  submitBuyoutFlow,
  type BuyoutFormTab,
} from '@/lib/buyout-request'
import Image from 'next/image'
import { ExternalLink, Search, Loader2, Plus, Send, X, Link2, Pencil, Check, TrendingUp } from 'lucide-react'
import { formatPrice } from '@/lib/utils'
import { createPortal } from 'react-dom'

function computeNotePopoverPosition(rect: DOMRect): { top: number; left: number; width: number } {
  const width = Math.min(240, window.innerWidth - 24)
  const margin = 12
  const approxHeight = 168
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
  register_url?: string
  lastBid?: { price: number; status: string }
  purchaseMode?: string
  site_name?: string
  siteName?: string
  /** ชื่อเว็ปจาก API */
  webName?: string
  web_name?: string
}

function siteNameFromItem(item: AuctionRequest): string {
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

type PurchaseMode = 'AUCTION' | 'BUYOUT'

type IntlShippingChoice = 'air' | 'sea'

/** ประมูลครั้งแรก: Yahoo / Mercari */
type AuctionFormTab = 'yahoo' | 'mercari'

/** ประมูล: เปิด bid กับชำระจบทันที ห้ามใช้พร้อมกัน */
type AuctionUiIntent = 'open_bid' | 'paid_instant'

function OpenBidForUserPageContent() {
  const searchParams = useSearchParams()

  const purchaseModeFromUrl = useMemo((): PurchaseMode => {
    return searchParams.get('purchase_mode') === 'BUYOUT' ? 'BUYOUT' : 'AUCTION'
  }, [searchParams])

  const [items, setItems] = useState<AuctionRequest[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [filterUser, setFilterUser] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [url, setUrl] = useState('')
  const [firstBidPrice, setFirstBidPrice] = useState('')
  const [intlShippingType, setIntlShippingType] = useState<IntlShippingChoice | null>(null)
  const [username, setUsername] = useState('')
  /** ชำระแล้ว (บาท) — ใช้คู่สลิปเมื่อ > 0 */
  const [paidThb, setPaidThb] = useState('')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  /** Mercari — ราคารายการ (เยน) บังคับ */
  const [mercariItemJpy, setMercariItemJpy] = useState('')
  const [auctionUiIntent, setAuctionUiIntent] = useState<AuctionUiIntent>('open_bid')
  const [buyoutTab, setBuyoutTab] = useState<BuyoutFormTab>('yahoo')
  const [productTitle, setProductTitle] = useState('')
  const [siteName, setSiteName] = useState('')
  const [priceYen, setPriceYen] = useState('')
  const [auctionTab, setAuctionTab] = useState<AuctionFormTab>('yahoo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [notePopoverPos, setNotePopoverPos] = useState<{
    top: number
    left: number
    width: number
  } | null>(null)
  const [noteSaving, setNoteSaving] = useState(false)
  const [biddingId, setBiddingId] = useState<number | null>(null)
  const [teamUsers, setTeamUsers] = useState<{ id: number; name: string }[]>([])
  const [bidModalItem, setBidModalItem] = useState<AuctionRequest | null>(null)
  const [bidPrice, setBidPrice] = useState('')
  const [bidModalUserId, setBidModalUserId] = useState('')
  const [bidModalError, setBidModalError] = useState('')
  const hasInitializedBidActor = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      params.set('page', '1')
      params.set('limit', '20')
      params.set('is_register', 'false')
      params.set(
        'purchase_mode',
        purchaseModeFromUrl === 'BUYOUT' ? 'BUYOUT' : 'AUCTION'
      )
      const purchaseQs = params.toString()

      const [bidsRes, usersRes] = await Promise.all([
        fetch(`${API_BACKOFFICE_PREFIX}/purchase-requests?${purchaseQs}`, {
          credentials: 'include',
        }),
        fetch(`${API_BACKOFFICE_PREFIX}/users`, { credentials: 'include' }),
      ])
      const bidsJson = await bidsRes.json()
      const usersJson = await usersRes.json()

      if (bidsJson.success) setItems(bidsJson.data ?? [])
      else setError(bidsJson.error?.message ?? 'Failed to load auction requests')

      if (usersJson.success) {
        const list = (usersJson.data ?? []).map(
          (u: { id: number; name?: string; username?: string }) => ({
            id: Number(u.id),
            name: (u.name ?? u.username ?? String(u.id)).trim() || String(u.id),
          })
        )
        setTeamUsers(list)
        if (list.length > 0 && !hasInitializedBidActor.current) {
          hasInitializedBidActor.current = true
        }
      }
    } catch {
      setError('Network error')
    } finally {
      setIsLoading(false)
    }
  }, [purchaseModeFromUrl])

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
    setIntlShippingType(null)
    setUsername('')
    setPaidThb('')
    setSlipFile(null)
    setMercariItemJpy('')
    setAuctionUiIntent('open_bid')
    setBuyoutTab('yahoo')
    setProductTitle('')
    setSiteName('')
    setPriceYen('')
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setFormError('')
    setUrl('')
    setFirstBidPrice('')
    setIntlShippingType(null)
    setUsername('')
    setPaidThb('')
    setSlipFile(null)
    setMercariItemJpy('')
    setAuctionUiIntent('open_bid')
    setBuyoutTab('yahoo')
    setProductTitle('')
    setSiteName('')
    setPriceYen('')
    setAuctionTab('yahoo')
  }

  const startEditNote = (itemId: number, currentNote: string | null, anchorRect: DOMRect) => {
    setEditingNoteId(itemId)
    setEditingNoteValue(currentNote ?? '')
    setNotePopoverPos(computeNotePopoverPosition(anchorRect))
  }

  const cancelEditNote = () => {
    setEditingNoteId(null)
    setEditingNoteValue('')
    setNotePopoverPos(null)
  }

  useEffect(() => {
    if (editingNoteId == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setEditingNoteId(null)
        setEditingNoteValue('')
        setNotePopoverPos(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editingNoteId])

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

  const openBidModal = (item: AuctionRequest) => {
    const requestPrice = item.lastBid?.price ?? 0
    const defaultPrice =
      requestPrice > item.currentPrice ? requestPrice : item.currentPrice + 1
    setBidModalItem(item)
    setBidPrice(String(defaultPrice))
    setBidModalUserId(teamUsers.length > 0 ? String(teamUsers[0].id) : '')
    setBidModalError('')
  }

  const closeBidModal = () => {
    setBidModalItem(null)
    setBidPrice('')
    setBidModalUserId('')
    setBidModalError('')
  }

  const handleSubmitBid = async () => {
    if (!bidModalItem) return
    const price = Number(bidPrice.replace(/[^0-9]/g, ''))
    const actorId = bidModalUserId ? Number(bidModalUserId) : 0
    if (price <= bidModalItem.currentPrice) {
      setBidModalError('ราคา Bid ต้องสูงกว่าราคาปัจจุบันอย่างน้อย 1 ¥')
      return
    }
    if (actorId <= 0) {
      setBidModalError('กรุณาเลือกผู้ดำเนินการ')
      return
    }
    setBiddingId(bidModalItem.id)
    setBidModalError('')
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/purchase-requests/${bidModalItem.id}/bids`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ price, biddedBy: actorId }),
          credentials: 'include',
        }
      )
      const json = await res.json()
      if (res.ok && json.success) {
        closeBidModal()
        fetchData()
      } else {
        setBidModalError(json.error?.message ?? 'Bid failed')
      }
    } catch {
      setBidModalError('Network error')
    } finally {
      setBiddingId(null)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    setIsSubmitting(true)
    try {
      if (intlShippingType === null) {
        setFormError('กรุณาเลือกประเภทการจัดส่ง')
        return
      }
      const shippingType = intlShippingType
      const uname = username.trim()
      const paidDigits = paidThb.replace(/[^0-9.]/g, '').replace(/\./g, '')
      const paidAmount = paidDigits === '' ? 0 : Number(paidDigits)
      const mercariDigits = mercariItemJpy.replace(/[^0-9]/g, '')
      const mercariJpy = mercariDigits === '' ? undefined : Number(mercariDigits)

      if (purchaseModeFromUrl === 'BUYOUT') {
        const u = url.trim()
        if (!u) {
          setFormError('กรุณากรอกลิงก์สินค้า')
          return
        }
        if (buyoutTab === 'mercari' && (mercariJpy == null || mercariJpy <= 0)) {
          setFormError('Mercari ต้องระบุราคารายการ (เยน)')
          return
        }
        if (paidAmount < 0) {
          setFormError('จำนวนเงิน (บาท) ไม่ถูกต้อง')
          return
        }
        if (paidAmount > 0 && !slipFile) {
          setFormError('กรุณาแนบสลิปเมื่อระบุยอดที่โอน (บาท)')
          return
        }
        if (buyoutTab === 'general_web') {
          const pt = productTitle.trim()
          const sn = siteName.trim()
          const py = priceYen.replace(/[^0-9]/g, '')
          if (!pt) {
            setFormError('กรุณากรอกชื่อสินค้า')
            return
          }
          if (!sn) {
            setFormError('กรุณากรอกชื่อเว็บไซต์')
            return
          }
          if (!py || Number(py) <= 0) {
            setFormError('กรุณากรอกราคา (เยน) ให้ถูกต้อง')
            return
          }
          await submitBuyoutFlow({
            buyoutTab: 'general_web',
            username: uname || undefined,
            url: u,
            intl_shipping_type: shippingType,
            client_entry: 'first_buyout',
            paidThb: paidAmount > 0 ? paidAmount : undefined,
            slip: paidAmount > 0 ? slipFile : undefined,
            product_title: pt,
            site_name: sn,
            first_bid_price: Number(py),
          })
        } else {
          await submitBuyoutFlow({
            buyoutTab,
            username: uname || undefined,
            url: u,
            intl_shipping_type: shippingType,
            client_entry: 'first_buyout',
            paidThb: paidAmount > 0 ? paidAmount : undefined,
            slip: paidAmount > 0 ? slipFile : undefined,
            item_price_jpy: buyoutTab === 'mercari' ? mercariJpy : undefined,
          })
        }
      } else {
        const u = url.trim()
        if (!u) {
          setFormError('กรุณากรอกลิงก์สินค้า')
          return
        }
        if (auctionTab === 'mercari' && (mercariJpy == null || mercariJpy <= 0)) {
          setFormError('Mercari ต้องระบุราคารายการ (เยน)')
          return
        }
        if (auctionUiIntent === 'paid_instant') {
          if (paidAmount <= 0) {
            setFormError('กรุณาระบุจำนวนเงินที่ลูกค้าโอน (บาท)')
            return
          }
          if (!slipFile) {
            setFormError('กรุณาแนบสลิปเมื่อมีการชำระเงิน')
            return
          }
          await submitAuctionFirstFlow({
            auction_source: auctionTab,
            username: uname || undefined,
            url: u,
            intl_shipping_type: shippingType,
            intent: 'paid_instant',
            paid: paidAmount,
            slip: slipFile,
            item_price_jpy: auctionTab === 'mercari' ? mercariJpy : undefined,
          })
        } else {
          const openingDigits = firstBidPrice.replace(/[^0-9]/g, '')
          const openingAmt =
            openingDigits === '' ? undefined : Number(openingDigits)
          if (openingAmt == null || openingAmt <= 0) {
            setFormError('กรุณากรอกราคาเปิดประมูล (เยน)')
            return
          }
          if (paidAmount > 0 || slipFile) {
            setFormError('โหมดเปิดประมูลไม่ใช้ยอดโอนบาท/สลิป — เปลี่ยนเป็น “ชำระแล้ว (จบดีล)” หรือล้างช่อง')
            return
          }
          await submitAuctionFirstFlow({
            auction_source: auctionTab,
            username: uname || undefined,
            url: u,
            intl_shipping_type: shippingType,
            intent: 'open_bid',
            first_bid_price: openingAmt,
            item_price_jpy: auctionTab === 'mercari' ? mercariJpy : undefined,
          })
        }
      }
      handleCloseModal()
      fetchData()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSubmitting(false)
    }
  }

  const pageTitle =
    purchaseModeFromUrl === 'BUYOUT' ? 'กดเว็ปครั้งแรก' : 'ประมูลครั้งแรก'
  const primaryActionLabel =
    purchaseModeFromUrl === 'BUYOUT' ? 'กดเว็ป' : 'ประมูล'
  const isBuyout = purchaseModeFromUrl === 'BUYOUT'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-muted mt-1">
            {purchaseModeFromUrl === 'BUYOUT'
              ? 'สร้างคำขอซื้อทันที (กดเว็ป) ให้ลูกค้า'
              : 'เปิดการประมูลให้ลูกค้า'}
          </p>
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
            {primaryActionLabel}
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
                  <th className="px-2 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-[5.25rem] max-w-[5.25rem] whitespace-nowrap">รหัสผู้ใช้</th>
                  <th className="px-2 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-[5.5rem] max-w-[5.5rem]">ชื่อผู้ใช้</th>
                  <th
                    className={`px-4 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center min-w-0 ${
                      isBuyout ? 'w-[20%]' : 'w-[12%]'
                    }`}
                  >
                    สินค้า
                  </th>
                  <th className="px-4 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-28 whitespace-nowrap">ลิงก์ประมูล</th>
                  <th
                    className={`text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center ${
                      isBuyout
                        ? 'w-[6rem] max-w-[6rem] min-w-0 shrink-0 px-3 py-4'
                        : 'min-w-[7rem] px-6 py-4'
                    }`}
                  >
                    ชื่อเว็ป
                  </th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">ราคาปัจจุบัน</th>
                  {!isBuyout && (
                    <>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">ราคาที่ขอ</th>
                      <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">เวลาสิ้นสุด</th>
                    </>
                  )}
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-28 whitespace-nowrap">โหมด</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-24 whitespace-nowrap">สถานะ</th>
                  <th className="px-2 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-[10rem] max-w-[10rem]">หมายเหตุ</th>
                  <th className="px-2 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-[7.1rem] max-w-[7.1rem] whitespace-nowrap bg-purple-100">ลงทะเบียน</th>
                  <th className="px-2 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-[8.9rem] max-w-[8.9rem] whitespace-nowrap">ดำเนินการ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr
                    key={item.id}
                    className="border-b border-sakura-100 last:border-0 hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="px-2 py-5 align-middle text-center w-[5.25rem] max-w-[5.25rem]">
                      <span className="inline-flex max-w-full items-center justify-center rounded-lg bg-sakura-100 px-1.5 py-1 font-mono text-[11px] font-medium text-sakura-800 truncate" title={item.externalId ?? undefined}>
                        {item.externalId ?? '-'}
                      </span>
                    </td>
                    <td className="px-2 py-5 align-middle text-center w-[5.5rem] max-w-[5.5rem]">
                      <span className="inline-flex max-w-full items-center justify-center rounded-lg bg-sakura-100 px-1.5 py-1 font-mono text-[11px] font-semibold text-sakura-800 truncate" title={item.username ?? undefined}>
                        {item.username ?? '-'}
                      </span>
                    </td>
                    <td className={`px-4 py-5 align-middle min-w-0 text-center ${isBuyout ? 'w-[20%]' : 'w-[12%]'}`}>
                      <div className="flex min-w-0 w-full flex-row items-center gap-3">
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
                        <span className="min-w-0 flex-1 font-medium text-sakura-900 line-clamp-3 text-center leading-snug break-words">
                          {item.title ?? '-'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-5 align-middle text-center w-28">
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.url}
                          className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          Link
                        </a>
                      ) : (
                        <span className="text-muted">-</span>
                      )}
                    </td>
                    <td
                      className={`py-5 align-middle text-center ${
                        isBuyout ? 'w-[6rem] max-w-[6rem] px-3' : 'max-w-[10rem] px-6'
                      }`}
                    >
                      <span
                        className="text-sm text-sakura-800 line-clamp-2 break-words"
                        title={siteNameFromItem(item)}
                      >
                        {siteNameFromItem(item)}
                      </span>
                    </td>
                    <td className="px-6 py-5 align-middle text-center w-[120px]">
                      <div className="flex min-h-[56px] w-full items-center justify-center">
                        <span className="font-bold tabular-nums text-sakura-900 whitespace-nowrap">
                          ¥{formatPrice(item.currentPrice)}
                        </span>
                      </div>
                    </td>
                    {!isBuyout && (
                      <>
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
                      </>
                    )}
                    <td className="px-6 py-5 align-middle text-center w-28">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {purchaseModeLabelTh(item.purchaseMode)}
                      </span>
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
                    <td className="px-2 py-5 align-middle text-center w-[10rem] max-w-[10rem] min-w-0">
                      <button
                        type="button"
                        onClick={(e) => startEditNote(item.id, item.note ?? null, e.currentTarget.getBoundingClientRect())}
                        className="inline-flex w-full max-w-full items-center justify-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-sakura-600 hover:bg-sakura-50 hover:text-sakura-800 transition-colors min-h-[28px] min-w-0"
                      >
                        <Pencil className="h-3 w-3 shrink-0 opacity-60" />
                        <span
                          className="min-w-0 max-w-[calc(100%-1.25rem)] truncate text-center"
                          title={item.note?.trim() || undefined}
                        >
                          {item.note?.trim() ? item.note.trim() : 'เพิ่มหมายเหตุ'}
                        </span>
                      </button>
                    </td>
                    <td className="px-2 py-5 align-middle text-center w-[7.1rem] max-w-[7.1rem] bg-purple-100">
                      {item.register_url ? (
                        <a
                          href={item.register_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={item.register_url}
                          className="inline-flex items-center justify-center gap-1 rounded-md px-1 py-1 text-sm font-medium text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                          Link
                        </a>
                      ) : (
                        <span className="text-muted text-xs">-</span>
                      )}
                    </td>
                    <td className="px-2 py-5 align-middle text-center w-[8.9rem] max-w-[8.9rem]">
                      {(() => {
                        const requestPrice = item.lastBid?.price ?? 0
                        const showBid = requestPrice > 0 && requestPrice < item.currentPrice
                        if (!showBid) return <span className="text-muted text-xs">—</span>
                        const isBidding = biddingId === item.id
                        return (
                          <button
                            type="button"
                            onClick={() => openBidModal(item)}
                            disabled={isBidding}
                            className="inline-flex items-center justify-center gap-0.5 rounded-lg bg-purple-600 px-2 py-1.5 text-xs font-semibold leading-tight text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
                            title="Bid"
                          >
                            {isBidding ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <TrendingUp className="h-3 w-3" />
                            )}
                            <span>Bid</span>
                          </button>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={isBuyout ? 11 : 13} className="px-6 py-16 text-center align-middle">
                      <p className="text-sakura-500 font-medium">
                        {filterUser ? `No bids found for "${filterUser}"` : 'No data'}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {filterUser
                          ? 'Try a different search term'
                          : purchaseModeFromUrl === 'BUYOUT'
                            ? 'กดปุ่มกดเว็ปเพื่อเพิ่มรายการ'
                            : 'กดปุ่มประมูลเพื่อเพิ่มรายการ'}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={handleCloseModal}
            aria-hidden="true"
          />
          <div
            className="relative z-10 w-full max-w-xl mx-4 bg-white rounded-2xl border border-card-border shadow-card p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-sakura-900">
                {purchaseModeFromUrl === 'BUYOUT' ? 'กดเว็ป' : 'ประมูล'}
              </h2>
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

            {purchaseModeFromUrl === 'BUYOUT' ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-1 p-1 rounded-xl bg-sakura-100/80 border border-sakura-200/60 w-full">
                  <button
                    type="button"
                    onClick={() => setBuyoutTab('yahoo')}
                    className={`flex-1 min-w-0 rounded-lg px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                      buyoutTab === 'yahoo'
                        ? 'bg-white text-sakura-900 shadow-sm'
                        : 'text-sakura-600 hover:text-sakura-900'
                    }`}
                  >
                    Yahoo
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyoutTab('mercari')}
                    className={`flex-1 min-w-0 rounded-lg px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                      buyoutTab === 'mercari'
                        ? 'bg-white text-sakura-900 shadow-sm'
                        : 'text-sakura-600 hover:text-sakura-900'
                    }`}
                  >
                    Mercari
                  </button>
                  <button
                    type="button"
                    onClick={() => setBuyoutTab('general_web')}
                    className={`flex-1 min-w-0 rounded-lg px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-semibold transition-colors ${
                      buyoutTab === 'general_web'
                        ? 'bg-white text-sakura-900 shadow-sm'
                        : 'text-sakura-600 hover:text-sakura-900'
                    }`}
                  >
                    เว็บทั่วไป
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ชื่อผู้ใช้ลูกค้า <span className="text-muted font-normal">(ไม่บังคับ)</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ถ้าระบุและตรง user ในระบบจะผูกคำขอ"
                    autoComplete="off"
                    className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm
                               focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ลิงก์สินค้า <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={
                        buyoutTab === 'yahoo'
                          ? 'https://auctions.yahoo.co.jp/...'
                          : buyoutTab === 'mercari'
                            ? 'https://jp.mercari.com/...'
                            : 'https://...'
                      }
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                 bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                 focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                    />
                  </div>
                </div>

                {buyoutTab === 'mercari' && (
                  <div>
                    <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                      ราคารายการ Mercari (เยน) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mercariItemJpy}
                        onChange={(e) => setMercariItemJpy(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="ราคาสินค้าจากหน้ารายการ"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                   bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                   focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {buyoutTab === 'general_web' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                        ชื่อสินค้า <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={productTitle}
                        onChange={(e) => setProductTitle(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                        ชื่อเว็บไซต์ <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={siteName}
                        onChange={(e) => setSiteName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm
                                   focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                        ราคา (เยน) <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={priceYen}
                          onChange={(e) => setPriceYen(e.target.value.replace(/[^0-9]/g, ''))}
                          placeholder="เช่น 12000"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                     bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                     focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ยอดที่ลูกค้าโอนแล้ว (บาท)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">฿</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={paidThb}
                      onChange={(e) => setPaidThb(e.target.value.replace(/[^0-9.]/g, ''))}
                      placeholder="ไม่โอนให้เว้นว่าง — ถ้ามียอดต้องแนบสลิป"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                 bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                 focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    สลิปโอนเงิน {paidThb.replace(/[^0-9]/g, '') !== '' && Number(paidThb.replace(/[^0-9.]/g, '')) > 0 ? <span className="text-red-400">*</span> : <span className="text-muted font-normal">(ถ้ามียอดบาท)</span>}
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
                    className="w-full text-sm text-sakura-900 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-medium"
                  />
                </div>

                <fieldset className="space-y-2.5">
                  <legend className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ประเภทการจัดส่ง <span className="text-red-400">*</span>
                  </legend>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-4">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer rounded-xl border border-card-border bg-sakura-50/50 px-4 py-3 text-sm text-sakura-900 transition-colors has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60">
                      <input
                        type="radio"
                        name="intl-shipping-buyout"
                        value="air"
                        checked={intlShippingType === 'air'}
                        onChange={() => setIntlShippingType('air')}
                        className="h-4 w-4 shrink-0 border-sakura-300 text-indigo-600 focus:ring-indigo-400"
                      />
                      <span>Air (ทางอากาศ)</span>
                    </label>
                    <label className="inline-flex items-center gap-2.5 cursor-pointer rounded-xl border border-card-border bg-sakura-50/50 px-4 py-3 text-sm text-sakura-900 transition-colors has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60">
                      <input
                        type="radio"
                        name="intl-shipping-buyout"
                        value="sea"
                        checked={intlShippingType === 'sea'}
                        onChange={() => setIntlShippingType('sea')}
                        className="h-4 w-4 shrink-0 border-sakura-300 text-indigo-600 focus:ring-indigo-400"
                      />
                      <span>Sea (ทางเรือ)</span>
                    </label>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={isSubmitting || intlShippingType === null}
                  className="btn-gradient w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      ส่งคำขอ
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="flex gap-1 p-1 rounded-xl bg-sakura-100/80 border border-sakura-200/60 w-full">
                  <button
                    type="button"
                    onClick={() => setAuctionTab('yahoo')}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      auctionTab === 'yahoo'
                        ? 'bg-white text-sakura-900 shadow-sm'
                        : 'text-sakura-600 hover:text-sakura-900'
                    }`}
                  >
                    Yahoo
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuctionTab('mercari')}
                    className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                      auctionTab === 'mercari'
                        ? 'bg-white text-sakura-900 shadow-sm'
                        : 'text-sakura-600 hover:text-sakura-900'
                    }`}
                  >
                    Mercari
                  </button>
                </div>

                <fieldset className="space-y-2 rounded-xl border border-indigo-200/60 bg-indigo-50/40 p-3">
                  <legend className="text-sm font-medium text-sakura-900 px-1">รูปแบบคำขอ</legend>
                  <label className="flex items-start gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="auction-intent"
                      checked={auctionUiIntent === 'open_bid'}
                      onChange={() => setAuctionUiIntent('open_bid')}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-sakura-900">เปิดประมูล</span>
                      <span className="block text-xs text-muted">ระบุราคาเปิด (เยน) — รอดำเนินการประมูล</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer text-sm">
                    <input
                      type="radio"
                      name="auction-intent"
                      checked={auctionUiIntent === 'paid_instant'}
                      onChange={() => setAuctionUiIntent('paid_instant')}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-medium text-sakura-900">ชำระแล้ว (จบดีลทันที)</span>
                      <span className="block text-xs text-muted">ยอดบาท + สลิป — ไม่ใช้ราคาเปิดประมูล</span>
                    </span>
                  </label>
                </fieldset>

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ชื่อผู้ใช้ลูกค้า <span className="text-muted font-normal">(ไม่บังคับ)</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      auctionTab === 'yahoo'
                        ? 'Yahoo Auctions / ระบุถ้ามี'
                        : 'Mercari / ระบุถ้ามี'
                    }
                    autoComplete="off"
                    className="w-full px-4 py-3 rounded-xl border border-card-border bg-sakura-50/50 text-sakura-900 text-sm
                               focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ลิงก์สินค้า <span className="text-red-400">*</span>
                  </label>
                  <div className="relative">
                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      placeholder={
                        auctionTab === 'yahoo'
                          ? 'https://auctions.yahoo.co.jp/...'
                          : 'https://jp.mercari.com/...'
                      }
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                 bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                 focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                    />
                  </div>
                </div>

                {auctionTab === 'mercari' && (
                  <div>
                    <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                      ราคารายการ Mercari (เยน) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={mercariItemJpy}
                        onChange={(e) => setMercariItemJpy(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="ราคาจากหน้ารายการ"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                   bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                   focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                )}

                {auctionUiIntent === 'open_bid' ? (
                  <div>
                    <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                      ราคาเปิดประมูล (เยน) <span className="text-red-400">*</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={firstBidPrice}
                        onChange={(e) => setFirstBidPrice(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="เช่น 5000"
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                   bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                   focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                      />
                    </div>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                        ยอดที่ลูกค้าโอนแล้ว (บาท) <span className="text-red-400">*</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">฿</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={paidThb}
                          onChange={(e) => setPaidThb(e.target.value.replace(/[^0-9.]/g, ''))}
                          placeholder="เช่น 15000"
                          className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                     bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                     focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                        สลิปโอนเงิน <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setSlipFile(e.target.files?.[0] ?? null)}
                        className="w-full text-sm text-sakura-900 file:mr-3 file:rounded-lg file:border-0 file:bg-indigo-50 file:px-3 file:py-2 file:text-xs file:font-medium"
                      />
                    </div>
                  </>
                )}

                <fieldset className="space-y-2.5">
                  <legend className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ประเภทการจัดส่ง <span className="text-red-400">*</span>
                  </legend>
                  <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-4">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer rounded-xl border border-card-border bg-sakura-50/50 px-4 py-3 text-sm text-sakura-900 transition-colors has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60">
                      <input
                        type="radio"
                        name="intl-shipping-auction"
                        value="air"
                        checked={intlShippingType === 'air'}
                        onChange={() => setIntlShippingType('air')}
                        className="h-4 w-4 shrink-0 border-sakura-300 text-indigo-600 focus:ring-indigo-400"
                      />
                      <span>Air (ทางอากาศ)</span>
                    </label>
                    <label className="inline-flex items-center gap-2.5 cursor-pointer rounded-xl border border-card-border bg-sakura-50/50 px-4 py-3 text-sm text-sakura-900 transition-colors has-[:checked]:border-indigo-400 has-[:checked]:bg-indigo-50/60">
                      <input
                        type="radio"
                        name="intl-shipping-auction"
                        value="sea"
                        checked={intlShippingType === 'sea'}
                        onChange={() => setIntlShippingType('sea')}
                        className="h-4 w-4 shrink-0 border-sakura-300 text-indigo-600 focus:ring-indigo-400"
                      />
                      <span>Sea (ทางเรือ)</span>
                    </label>
                  </div>
                </fieldset>

                <button
                  type="submit"
                  disabled={isSubmitting || intlShippingType === null}
                  className="btn-gradient w-full flex items-center justify-center gap-2 py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                >
                  {isSubmitting ? (
                    <span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      ส่งคำขอ
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Bid Modal */}
      {bidModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeBidModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg mx-4 bg-white rounded-2xl border border-card-border shadow-card p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-sakura-900 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-purple-600" />
                ส่ง Bid
              </h2>
              <button
                type="button"
                onClick={closeBidModal}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900 transition-colors"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mb-4 text-sm text-sakura-700 line-clamp-3">
              {bidModalItem.title ?? '-'}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                ราคาปัจจุบัน
              </label>
              <div className="inline-flex items-center rounded-xl bg-sakura-100 px-4 py-2.5 font-bold text-sakura-900">
                ¥{formatPrice(bidModalItem.currentPrice)}
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                ผู้ดำเนินการ (user) <span className="text-red-400">*</span>
              </label>
              <select
                value={bidModalUserId}
                onChange={(e) => setBidModalUserId(e.target.value)}
                className="w-full rounded-xl border border-card-border bg-white px-4 py-3 text-sm text-sakura-900
                           focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
              >
                <option value="">เลือกผู้ดำเนินการ...</option>
                {teamUsers.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-5">
              <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                ราคา Bid ของคุณ <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">
                  ¥
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={bidPrice}
                  onChange={(e) => setBidPrice(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={`มากกว่า ¥${formatPrice(bidModalItem.currentPrice)}`}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                             bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                             focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-transparent"
                />
              </div>
              <p className="mt-1.5 text-xs text-red-500">
                * ราคา Bid ต้องสูงกว่าราคาปัจจุบันอย่างน้อย 1 ¥
              </p>
            </div>

            {bidModalError && (
              <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                {bidModalError}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={closeBidModal}
                className="flex-1 rounded-xl border border-card-border px-4 py-3 text-sm font-medium text-sakura-700
                           hover:bg-sakura-50 transition-colors"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleSubmitBid}
                disabled={biddingId === bidModalItem.id}
                className="flex-1 rounded-xl bg-purple-600 px-4 py-3 text-sm font-semibold text-white
                           hover:bg-purple-700 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
              >
                {biddingId === bidModalItem.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <TrendingUp className="h-4 w-4" />
                    ส่ง Bid
                  </>
                )}
              </button>
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
              aria-labelledby="note-popover-title"
              className="fixed z-[210] flex max-h-[min(300px,calc(100vh-24px))] flex-col rounded-xl border border-sakura-200/90 bg-white p-3 shadow-lg ring-1 ring-black/5"
              style={{
                top: notePopoverPos.top,
                left: notePopoverPos.left,
                width: notePopoverPos.width,
                maxWidth: 'min(240px, calc(100vw - 24px))',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <p id="note-popover-title" className="text-xs font-semibold text-sakura-900 mb-1.5">
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
    </div>
  )
}

export default function OpenBidForUserPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-muted">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      }
    >
      <OpenBidForUserPageContent />
    </Suspense>
  )
}
