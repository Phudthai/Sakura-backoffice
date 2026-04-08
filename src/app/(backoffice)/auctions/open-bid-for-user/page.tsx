'use client'

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import {
  postAuctionRequest,
  submitBuyoutFlow,
  type BuyoutFormTab,
} from '@/lib/buyout-request'
import Image from 'next/image'
import { ExternalLink, Search, Loader2, Plus, Send, X, Link2, Pencil, Check, TrendingUp, ChevronDown } from 'lucide-react'
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
  purchaseMode?: string
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

async function submitAuctionFirstFlow(payload: {
  auctionSource: AuctionFormTab
  username: string
  url: string
  intl_shipping_type: 'air' | 'sea'
  transferredYen?: number
  openingBidYen?: number
}): Promise<{ id: number; data: unknown }> {
  const base: Record<string, unknown> = {
    purchase_mode: 'AUCTION' as const,
    auctionSource: payload.auctionSource,
    url: payload.url.trim(),
    intl_shipping_type: payload.intl_shipping_type,
    username: payload.username.trim(),
  }
  if (payload.transferredYen != null && Number.isFinite(payload.transferredYen)) {
    base.transferredYen = payload.transferredYen
  }
  if (payload.openingBidYen != null && Number.isFinite(payload.openingBidYen)) {
    base.firstBidPrice = payload.openingBidYen
  }
  return postAuctionRequest(base)
}

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
  /** โอนมาแล้ว — จำนวนเงิน (เยน) */
  const [transferredYen, setTransferredYen] = useState('')
  const [buyoutTab, setBuyoutTab] = useState<BuyoutFormTab>('yahoo')
  const [productTitle, setProductTitle] = useState('')
  const [siteName, setSiteName] = useState('')
  const [priceYen, setPriceYen] = useState('')
  const [auctionTab, setAuctionTab] = useState<AuctionFormTab>('yahoo')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null)
  const [editingNoteValue, setEditingNoteValue] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [biddingId, setBiddingId] = useState<number | null>(null)
  const [staffs, setStaffs] = useState<{ id: number; name: string }[]>([])
  const [bidModalItem, setBidModalItem] = useState<AuctionRequest | null>(null)
  const [bidPrice, setBidPrice] = useState('')
  const [bidModalStaff, setBidModalStaff] = useState('')
  const [bidModalError, setBidModalError] = useState('')
  const hasInitializedStaff = useRef(false)

  const fetchData = useCallback(async () => {
    try {
      const [bidsRes, staffsRes] = await Promise.all([
        fetch(`${API_BACKOFFICE_PREFIX}/purchase-requests?page=1&limit=20&status=pending`, {
          credentials: 'include',
        }),
        fetch(`${API_BACKOFFICE_PREFIX}/staffs`, { credentials: 'include' }),
      ])
      const bidsJson = await bidsRes.json()
      const staffsJson = await staffsRes.json()

      if (bidsJson.success) setItems(bidsJson.data ?? [])
      else setError(bidsJson.error?.message ?? 'Failed to load auction requests')

      if (staffsJson.success) {
        const list = (staffsJson.data ?? []).map((s: { id: number; name: string }) => ({
          id: Number(s.id),
          name: s.name ?? String(s.id),
        }))
        setStaffs(list)
        if (list.length > 0 && !hasInitializedStaff.current) {
          hasInitializedStaff.current = true
        }
      }
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
    setIntlShippingType(null)
    setUsername('')
    setTransferredYen('')
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
    setTransferredYen('')
    setBuyoutTab('yahoo')
    setProductTitle('')
    setSiteName('')
    setPriceYen('')
    setAuctionTab('yahoo')
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
    setBidModalStaff(staffs.length > 0 ? String(staffs[0].id) : '')
    setBidModalError('')
  }

  const closeBidModal = () => {
    setBidModalItem(null)
    setBidPrice('')
    setBidModalStaff('')
    setBidModalError('')
  }

  const handleSubmitBid = async () => {
    if (!bidModalItem) return
    const price = Number(bidPrice.replace(/[^0-9]/g, ''))
    const staffId = bidModalStaff ? Number(bidModalStaff) : 0
    if (price <= bidModalItem.currentPrice) {
      setBidModalError('ราคา Bid ต้องสูงกว่าราคาปัจจุบันอย่างน้อย 1 ¥')
      return
    }
    if (staffId <= 0) {
      setBidModalError('กรุณาเลือก Staff')
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
          body: JSON.stringify({ price, biddedBy: staffId }),
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
      if (purchaseModeFromUrl === 'BUYOUT') {
        const uname = username.trim()
        if (!uname) {
          setFormError('กรุณากรอกชื่อผู้ใช้')
          return
        }
        const u = url.trim()
        if (!u) {
          setFormError('กรุณากรอกลิงก์สินค้า')
          return
        }
        const transferDigits = transferredYen.replace(/[^0-9]/g, '')
        const transferAmount =
          transferDigits === '' ? undefined : Number(transferDigits)
        if (transferDigits !== '' && (transferAmount === undefined || transferAmount < 0)) {
          setFormError('กรุณากรอกจำนวนเงินโอน (เยน) ให้ถูกต้อง')
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
            username: uname,
            url: u,
            transferredYen: transferAmount,
            intl_shipping_type: shippingType,
            productTitle: pt,
            siteName: sn,
            priceYen: Number(py),
          })
        } else {
          await submitBuyoutFlow({
            buyoutTab,
            username: uname,
            url: u,
            transferredYen: transferAmount,
            intl_shipping_type: shippingType,
          })
        }
      } else {
        const u = url.trim()
        if (!u) {
          setFormError('กรุณากรอกลิงก์สินค้า')
          return
        }
        const transferDigits = transferredYen.replace(/[^0-9]/g, '')
        const transferAmt =
          transferDigits === '' ? undefined : Number(transferDigits)
        const openingDigits = firstBidPrice.replace(/[^0-9]/g, '')
        const openingAmt =
          openingDigits === '' ? undefined : Number(openingDigits)

        const uname = username.trim()
        if (!uname) {
          setFormError('กรุณากรอกผู้ใช้งาน')
          return
        }
        if (transferDigits !== '' && (transferAmt === undefined || transferAmt < 0)) {
          setFormError('กรุณากรอกโอนมาแล้ว (เยน) ให้ถูกต้อง')
          return
        }
        if (
          openingDigits !== '' &&
          (openingAmt === undefined || openingAmt <= 0)
        ) {
          setFormError('กรุณากรอกราคาเปิดประมูล (เยน) ให้ถูกต้อง')
          return
        }
        if (
          (transferDigits === '' || transferAmt === undefined) &&
          (openingDigits === '' || openingAmt === undefined)
        ) {
          setFormError('กรุณากรอกโอนมาแล้ว (เยน) หรือราคาเปิดประมูล (เยน) อย่างน้อยหนึ่งช่อง')
          return
        }
        await submitAuctionFirstFlow({
          auctionSource: auctionTab,
          username: uname,
          url: u,
          intl_shipping_type: shippingType,
          transferredYen:
            transferDigits !== '' && transferAmt !== undefined
              ? transferAmt
              : undefined,
          openingBidYen:
            openingDigits !== '' && openingAmt !== undefined && openingAmt > 0
              ? openingAmt
              : undefined,
        })
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
    purchaseModeFromUrl === 'BUYOUT' ? 'กดเว็ป' : 'Auction'

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">{pageTitle}</h1>
          <p className="text-sm text-muted mt-1">
            {purchaseModeFromUrl === 'BUYOUT'
              ? 'สร้างคำขอซื้อทันที (BUYOUT) ให้ลูกค้า'
              : 'เปิดการประมูล (AUCTION) ให้ลูกค้า'}
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
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">รหัสผู้ใช้</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36">ชื่อผู้ใช้</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">สินค้า</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap">ลิงก์ประมูล</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">ราคาปัจจุบัน</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 text-center align-middle w-[120px] whitespace-nowrap">ราคาที่ขอ</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">เวลาสิ้นสุด</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-28 whitespace-nowrap">โหมด</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-24 whitespace-nowrap">สถานะ</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">หมายเหตุ</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center w-36 whitespace-nowrap bg-purple-100">ลิงก์ลงทะเบียน</th>
                  <th className="px-6 py-4 text-xs font-semibold uppercase tracking-wider text-sakura-600 align-middle text-center">การดำเนินการ</th>
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
                    <td className="px-6 py-5 align-middle text-center w-28">
                      <span className="inline-flex items-center rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800 whitespace-nowrap">
                        {item.purchaseMode ?? '—'}
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
                    <td className="px-6 py-5 align-middle text-center w-36 bg-purple-100">
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
                      {(() => {
                        const requestPrice = item.lastBid?.price ?? 0
                        const showBid = requestPrice > 0 && requestPrice < item.currentPrice
                        if (!showBid) return <span className="text-muted">—</span>
                        const isBidding = biddingId === item.id
                        return (
                          <button
                            type="button"
                            onClick={() => openBidModal(item)}
                            disabled={isBidding}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-purple-600 px-4 py-2 text-xs font-semibold text-white hover:bg-purple-700 disabled:opacity-60 disabled:cursor-not-allowed"
                          >
                            {isBidding ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <TrendingUp className="h-4 w-4" />
                            )}
                            Bid
                            <ChevronDown className="h-4 w-4 opacity-70" />
                          </button>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && !isLoading && (
                  <tr>
                    <td colSpan={12} className="px-6 py-16 text-center align-middle">
                      <p className="text-sakura-500 font-medium">
                        {filterUser ? `No bids found for "${filterUser}"` : 'No data'}
                      </p>
                      <p className="text-sm text-muted mt-1">
                        {filterUser
                          ? 'Try a different search term'
                          : purchaseModeFromUrl === 'BUYOUT'
                            ? 'กดปุ่มกดเว็ปเพื่อเพิ่มรายการ'
                            : 'กดปุ่ม Auction เพื่อเพิ่มรายการ'}
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
                {purchaseModeFromUrl === 'BUYOUT' ? 'กดเว็ป' : 'Auction'}
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
                    ชื่อผู้ใช้ <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="ชื่อผู้ใช้ลูกค้า"
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
                    โอนมาแล้ว (เยน)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={transferredYen}
                      onChange={(e) => setTransferredYen(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="จำนวนเงินที่โอน (ไม่บังคับ)"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                 bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                 focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">กรอกเป็นจำนวนเยน (¥) หากยังไม่โอนให้เว้นว่าง</p>
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

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ผู้ใช้งาน <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={
                      auctionTab === 'yahoo'
                        ? 'ผู้ใช้งาน Yahoo Auctions'
                        : 'ผู้ใช้งาน Mercari'
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

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    โอนมาแล้ว (เยน)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={transferredYen}
                      onChange={(e) => setTransferredYen(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="จำนวนที่โอน (ไม่บังคับ)"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                 bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                 focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-sakura-900 mb-1.5">
                    ราคาเปิดประมูล (เยน)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted font-medium">¥</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={firstBidPrice}
                      onChange={(e) => setFirstBidPrice(e.target.value.replace(/[^0-9]/g, ''))}
                      placeholder="เช่น 5000 (ไม่บังคับ)"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-card-border
                                 bg-sakura-50/50 text-sakura-900 text-sm placeholder:text-muted
                                 focus:outline-none focus:ring-2 focus:ring-sakura-400 focus:border-transparent"
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-muted">
                    กรอกอย่างน้อยหนึ่งช่องระหว่างโอนมาแล้วกับราคาเปิดประมูล
                  </p>
                </div>

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
                Staff <span className="text-red-400">*</span>
              </label>
              <select
                value={bidModalStaff}
                onChange={(e) => setBidModalStaff(e.target.value)}
                className="w-full rounded-xl border border-card-border bg-white px-4 py-3 text-sm text-sakura-900
                           focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300"
              >
                <option value="">Select staff...</option>
                {staffs.map((s) => (
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
