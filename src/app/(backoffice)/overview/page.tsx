'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { formatPrice } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type OverviewTab = 'air' | 'sea'

const OVERVIEW_TABS: { id: OverviewTab; label: string }[] = [
  { id: 'air', label: 'Air' },
  { id: 'sea', label: 'Sea' },
]

interface LotListItem {
  id: number
  lot_code: string
  intl_shipping_type?: string
  start_lot_at: string | null
  end_lot_at: string | null
  arrive_at: string | null
  is_arrived?: boolean
  is_delayed?: boolean
  auction_count?: number
  createdAt: string
  updatedAt: string
}

interface GroupedLotsData {
  air: LotListItem[]
  sea: LotListItem[]
}

interface MoneyBreakdown {
  totalBaht: number
  paidBaht: number
  outstandingBaht: number
}

interface OverviewStatsData {
  scope: {
    lotId: number | null
    status: string
    intlShippingType?: string
  }
  totalGrams: number
  product: MoneyBreakdown
  intlShipping: MoneyBreakdown
}

type LotSelectValue = '' | number

const EMPTY_LOT_FILTER: Record<OverviewTab, LotSelectValue> = {
  air: '',
  sea: '',
}

export default function OverviewPage() {
  const [grouped, setGrouped] = useState<GroupedLotsData | null>(null)
  const [groupedError, setGroupedError] = useState('')
  const [loadingLots, setLoadingLots] = useState(true)

  const [activeTab, setActiveTab] = useState<OverviewTab>('air')
  /** ฟิลเตอร์ Lot แยกตามแท็บ — สลับแท็บแล้วค่าไม่หาย */
  const [lotFilter, setLotFilter] =
    useState<Record<OverviewTab, LotSelectValue>>(EMPTY_LOT_FILTER)
  const [stats, setStats] = useState<OverviewStatsData | null>(null)
  const [statsError, setStatsError] = useState('')
  const [loadingStats, setLoadingStats] = useState(false)

  const fetchGrouped = useCallback(async () => {
    setLoadingLots(true)
    setGroupedError('')
    try {
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/lots/grouped-by-shipping-type`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (json.success && json.data) {
        setGrouped({
          air: json.data.air ?? [],
          sea: json.data.sea ?? [],
        })
      } else {
        setGroupedError(json.error?.message ?? 'โหลดรายการ lot ไม่สำเร็จ')
        setGrouped(null)
      }
    } catch {
      setGroupedError('Network error')
      setGrouped(null)
    } finally {
      setLoadingLots(false)
    }
  }, [])

  const fetchStats = useCallback(
    async (lotId: LotSelectValue, tabForReset: OverviewTab) => {
    setLoadingStats(true)
    setStatsError('')
    setStats(null)
    try {
      const params = new URLSearchParams()
      params.set('type', tabForReset)
      if (lotId !== '') {
        params.set('lot_id', String(lotId))
      }
      const qs = `?${params.toString()}`
      const res = await fetch(
        `${API_BACKOFFICE_PREFIX}/overview/stats${qs}`,
        { credentials: 'include' }
      )
      const json = await res.json()
      if (res.status === 404) {
        setStatsError(
          json.error?.message ?? 'ไม่พบ lot ที่เลือกหรือไม่มีในระบบ'
        )
        setLotFilter((prev) => ({ ...prev, [tabForReset]: '' }))
        return
      }
      if (res.status === 400) {
        setStatsError(
          json.error?.message ?? 'คำขอไม่ถูกต้อง (ตรวจสอบ type / lot_id)'
        )
        if (lotId !== '') {
          setLotFilter((prev) => ({ ...prev, [tabForReset]: '' }))
        }
        return
      }
      if (json.success && json.data) {
        setStats(json.data as OverviewStatsData)
      } else {
        setStatsError(json.error?.message ?? 'โหลดสถิติไม่สำเร็จ')
      }
    } catch {
      setStatsError('Network error')
    } finally {
      setLoadingStats(false)
    }
  },
  []
)

  useEffect(() => {
    fetchGrouped()
  }, [fetchGrouped])

  useEffect(() => {
    if (loadingLots) return
    fetchStats(lotFilter[activeTab], activeTab)
  }, [activeTab, lotFilter, loadingLots, fetchStats])

  const lotOptions = useMemo(() => {
    if (!grouped) return []
    const list = activeTab === 'air' ? grouped.air : grouped.sea
    return [...list].sort((a, b) => b.id - a.id)
  }, [grouped, activeTab])

  useEffect(() => {
    if (!grouped) return
    setLotFilter((prev) => {
      const next = { ...prev }
      let changed = false
      ;(['air', 'sea'] as const).forEach((tab) => {
        const id = prev[tab]
        if (id === '') return
        const list = tab === 'air' ? grouped.air : grouped.sea
        if (!list.some((l) => l.id === id)) {
          next[tab] = ''
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [grouped])

  const formatBaht = (n: number) => `฿${formatPrice(n)}`

  return (
    <div>
      <div className="flex flex-col gap-4 mb-6">
        <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">
          Overview
        </h1>

        <div className="flex gap-1 p-1 rounded-xl bg-sakura-100/80 border border-sakura-200/60 w-fit flex-wrap">
          {OVERVIEW_TABS.map((tab) => (
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

        <div className="flex flex-col gap-1 max-w-md">
          <label className="text-xs font-medium text-sakura-600">
            {activeTab === 'air' ? 'กรอง Lot — Air' : 'กรอง Lot — Sea'}
          </label>
          <select
            value={
              lotFilter[activeTab] === ''
                ? ''
                : String(lotFilter[activeTab])
            }
            onChange={(e) => {
              const v = e.target.value
              const next = v === '' ? '' : Number(v)
              setLotFilter((prev) => ({ ...prev, [activeTab]: next }))
            }}
            disabled={loadingLots}
            className="rounded-xl border border-card-border bg-white px-4 py-2.5 text-sm text-sakura-900
                       focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
          >
            <option value="">ทั้งหมด</option>
            {lotOptions.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {lot.lot_code}
              </option>
            ))}
          </select>
        </div>
      </div>

      {groupedError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          {groupedError}
        </div>
      )}

      {statsError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          {statsError}
        </div>
      )}

      {loadingStats && !stats && !statsError && (
        <div className="flex items-center justify-center py-16 text-muted">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      )}

      {stats && !loadingStats && (
        <div className="space-y-6">
          <p className="text-sm text-muted">
            ขอบเขต:{' '}
            <span className="font-medium text-sakura-800">
              {stats.scope.intlShippingType
                ? `${String(stats.scope.intlShippingType).toUpperCase()} · `
                : ''}
              {stats.scope.lotId == null
                ? `ทั้งหมด (${stats.scope.status})`
                : `Lot ID ${stats.scope.lotId} · ${stats.scope.status}`}
            </span>
          </p>

          <div className="rounded-2xl border border-sakura-200/60 bg-white shadow-card p-6">
            <p className="text-xs font-medium text-sakura-600 uppercase tracking-wider mb-1">
              น้ำหนักรวม (กรัม)
            </p>
            <p className="text-2xl font-bold text-sakura-900 tabular-nums">
              {formatPrice(stats.totalGrams)}
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-emerald-900 mb-4">
                สินค้า (PRODUCT_FULL)
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">ยอดรวม</dt>
                  <dd className="font-semibold tabular-nums text-sakura-900">
                    {formatBaht(stats.product.totalBaht)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">ชำระแล้ว</dt>
                  <dd className="font-semibold tabular-nums text-emerald-800">
                    {formatBaht(stats.product.paidBaht)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">ค้างชำระ</dt>
                  <dd className="font-semibold tabular-nums text-amber-800">
                    {formatBaht(stats.product.outstandingBaht)}
                  </dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-sky-200/80 bg-sky-50/50 p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-sky-900 mb-4">
                ขนส่งต่างประเทศ (INTL_SHIPPING)
              </h2>
              <dl className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">ยอดรวม</dt>
                  <dd className="font-semibold tabular-nums text-sakura-900">
                    {formatBaht(stats.intlShipping.totalBaht)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">ชำระแล้ว</dt>
                  <dd className="font-semibold tabular-nums text-emerald-800">
                    {formatBaht(stats.intlShipping.paidBaht)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">ค้างชำระ</dt>
                  <dd className="font-semibold tabular-nums text-amber-800">
                    {formatBaht(stats.intlShipping.outstandingBaht)}
                  </dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
