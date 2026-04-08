'use client'

import { useState, useEffect, useCallback } from 'react'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { formatPrice } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

type OverviewTab = 'air' | 'sea'

const OVERVIEW_TABS: { id: OverviewTab; label: string }[] = [
  { id: 'air', label: 'Air' },
  { id: 'sea', label: 'Sea' },
]

function monthInputValueBangkok(d = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Bangkok',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(d)
  const y = parts.find((p) => p.type === 'year')?.value
  const m = parts.find((p) => p.type === 'month')?.value
  return y && m ? `${y}-${m}` : ''
}

/** Converts `yyyy-MM` from UI to API month e.g. `2026-3`. */
function toMonthQueryParam(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  if (!y || !m) return ''
  const monthNum = Number.parseInt(m, 10)
  if (!Number.isFinite(monthNum)) return ''
  return `${y}-${monthNum}`
}

/** Backend month string (`2026-3` or `2026-03`) → `yyyy-MM` for `<select>` / state. */
function apiMonthToYyyyMm(api: string): string | null {
  const trimmed = api.trim()
  const parts = trimmed.split('-')
  if (parts.length < 2) return null
  const y = parts[0]
  const m = parts[1]
  if (!y || m === undefined) return null
  const monthNum = Number.parseInt(m, 10)
  if (!Number.isFinite(monthNum) || monthNum < 1 || monthNum > 12) return null
  const yi = Number.parseInt(y, 10)
  if (!Number.isFinite(yi)) return null
  return `${yi}-${String(monthNum).padStart(2, '0')}`
}

function sortMonthsDescUnique(yyyyMms: string[]): string[] {
  return [...new Set(yyyyMms)].sort((a, b) => b.localeCompare(a))
}

function formatMonthLabelYyyyMm(yyyyMm: string): string {
  const [y, m] = yyyyMm.split('-')
  if (!y || !m) return yyyyMm
  const d = new Date(Number(y), Number(m) - 1, 1)
  return d.toLocaleDateString('th-TH', {
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Bangkok',
  })
}

interface MoneyBreakdown {
  totalBaht: number
  paidBaht: number
  outstandingBaht: number
}

interface OverviewStatsData {
  scope: {
    year?: number
    month?: number
    purchaseMode?: string
    status?: string
    intlShippingType?: string
    boughtAtRangeBangkok?: { start?: string; end?: string }
  }
  totalGrams: number
  product: MoneyBreakdown
  intlShipping: MoneyBreakdown
}

type PurchaseModeFilter = 'all' | 'AUCTION' | 'BUYOUT'

const EMPTY_PURCHASE_MODE: Record<OverviewTab, PurchaseModeFilter> = {
  air: 'all',
  sea: 'all',
}

export default function OverviewPage() {
  const [activeTab, setActiveTab] = useState<OverviewTab>('air')
  const [monthByTab, setMonthByTab] = useState<Record<OverviewTab, string>>(() => {
    const m = monthInputValueBangkok()
    return { air: m, sea: m }
  })
  const [purchaseModeByTab, setPurchaseModeByTab] =
    useState<Record<OverviewTab, PurchaseModeFilter>>(EMPTY_PURCHASE_MODE)

  const [availableMonths, setAvailableMonths] = useState<string[]>([])
  const [loadingMonths, setLoadingMonths] = useState(true)
  const [monthsError, setMonthsError] = useState('')

  const [stats, setStats] = useState<OverviewStatsData | null>(null)
  const [statsError, setStatsError] = useState('')
  const [loadingStats, setLoadingStats] = useState(false)

  const purchaseMode = purchaseModeByTab[activeTab]

  useEffect(() => {
    let cancelled = false
    async function loadMonths() {
      setLoadingMonths(true)
      setMonthsError('')
      setAvailableMonths([])
      try {
        const params = new URLSearchParams()
        params.set('type', activeTab)
        params.set('purchase_mode', purchaseMode)
        const res = await fetch(
          `${API_BACKOFFICE_PREFIX}/overview/months?${params.toString()}`,
          { credentials: 'include' }
        )
        const json: {
          success?: boolean
          data?: { months?: string[] }
          error?: { message?: string }
        } = await res.json()
        if (cancelled) return
        if (!res.ok || !json.success) {
          setMonthsError(
            json.error?.message ?? 'โหลดรายการเดือนไม่สำเร็จ'
          )
          setAvailableMonths([])
          return
        }
        const raw = json.data?.months ?? []
        const parsed = raw
          .map((s) => apiMonthToYyyyMm(String(s)))
          .filter((x): x is string => x !== null)
        const sorted = sortMonthsDescUnique(parsed)
        setAvailableMonths(sorted)
        setMonthByTab((prev) => {
          const cur = prev[activeTab]
          if (sorted.length === 0) {
            return { ...prev, [activeTab]: '' }
          }
          if (cur && sorted.includes(cur)) {
            return prev
          }
          return { ...prev, [activeTab]: sorted[0]! }
        })
      } catch {
        if (!cancelled) {
          setMonthsError('Network error')
          setAvailableMonths([])
        }
      } finally {
        if (!cancelled) setLoadingMonths(false)
      }
    }
    void loadMonths()
    return () => {
      cancelled = true
    }
  }, [activeTab, purchaseMode])

  const fetchStats = useCallback(
    async (tab: OverviewTab, monthValue: string, purchaseModeFilter: PurchaseModeFilter) => {
      setLoadingStats(true)
      setStatsError('')
      setStats(null)
      const monthParam = toMonthQueryParam(monthValue)
      if (!monthParam) {
        setStatsError('กรุณาเลือกเดือน (month)')
        setLoadingStats(false)
        return
      }
      try {
        const params = new URLSearchParams()
        params.set('type', tab)
        params.set('month', monthParam)
        if (purchaseModeFilter !== 'all') {
          params.set('purchase_mode', purchaseModeFilter)
        }
        const qs = `?${params.toString()}`
        const res = await fetch(
          `${API_BACKOFFICE_PREFIX}/overview/stats${qs}`,
          { credentials: 'include' }
        )
        const json = await res.json()
        if (res.status === 400) {
          setStatsError(
            json.error?.message ?? 'คำขอไม่ถูกต้อง (ตรวจสอบ type / month / purchase_mode)'
          )
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
    if (loadingMonths) return
    const m = monthByTab[activeTab]
    if (!m) return
    void fetchStats(activeTab, m, purchaseModeByTab[activeTab])
  }, [activeTab, monthByTab, purchaseModeByTab, fetchStats, loadingMonths])

  const formatBaht = (n: number) => `฿${formatPrice(n)}`

  const monthInput = monthByTab[activeTab] || ''

  const monthSelectValue =
    loadingMonths || availableMonths.length === 0
      ? ''
      : availableMonths.includes(monthInput)
        ? monthInput
        : (availableMonths[0] ?? '')

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

        <div className="flex flex-col sm:flex-row flex-wrap gap-4 max-w-2xl">
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-xs font-medium text-sakura-600">
              เดือน (Asia/Bangkok) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <select
                value={monthSelectValue}
                disabled={loadingMonths || availableMonths.length === 0}
                onChange={(e) => {
                  const v = e.target.value
                  setMonthByTab((prev) => ({ ...prev, [activeTab]: v }))
                }}
                className="w-full rounded-xl border border-card-border bg-white px-4 py-2.5 text-sm text-sakura-900
                           focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300
                           disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loadingMonths ? (
                  <option value="">กำลังโหลด...</option>
                ) : availableMonths.length === 0 ? (
                  <option value="">ไม่มีเดือนที่มีข้อมูล</option>
                ) : (
                  availableMonths.map((ym) => (
                    <option key={ym} value={ym}>
                      {formatMonthLabelYyyyMm(ym)}
                    </option>
                  ))
                )}
              </select>
              {loadingMonths && (
                <span className="absolute right-10 top-1/2 -translate-y-1/2 pointer-events-none">
                  <Loader2 className="h-4 w-4 animate-spin text-muted" />
                </span>
              )}
            </div>
            {monthsError && (
              <p className="text-xs text-red-600">{monthsError}</p>
            )}
            <p className="text-xs text-muted">
              สถิตินับเฉพาะรายการ completed ที่ bought_at อยู่ในเดือนนี้
            </p>
          </div>
          <div className="flex flex-col gap-1 min-w-[200px]">
            <label className="text-xs font-medium text-sakura-600">
              โหมดการซื้อ
            </label>
            <select
              value={purchaseModeByTab[activeTab]}
              onChange={(e) =>
                setPurchaseModeByTab((prev) => ({
                  ...prev,
                  [activeTab]: e.target.value as PurchaseModeFilter,
                }))
              }
              className="rounded-xl border border-card-border bg-white px-4 py-2.5 text-sm text-sakura-900
                         focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-300"
            >
              <option value="all">ทั้งหมด (ประมูล + ซื้อทันที)</option>
              <option value="AUCTION">AUCTION</option>
              <option value="BUYOUT">BUYOUT</option>
            </select>
          </div>
        </div>
      </div>

      {statsError && (
        <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
          {statsError}
        </div>
      )}

      {loadingStats && !stats && !statsError && !loadingMonths && monthInput && (
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
              {stats.scope.year != null && stats.scope.month != null
                ? `เดือน ${stats.scope.year}-${stats.scope.month} (Bangkok)`
                : '—'}
              {stats.scope.purchaseMode && stats.scope.purchaseMode !== 'all'
                ? ` · ${stats.scope.purchaseMode}`
                : ''}
              {stats.scope.status ? ` · ${stats.scope.status}` : ''}
            </span>
          </p>
          {stats.scope.boughtAtRangeBangkok &&
            (stats.scope.boughtAtRangeBangkok.start ||
              stats.scope.boughtAtRangeBangkok.end) && (
              <p className="text-xs text-muted">
                ช่วง bought_at:{' '}
                {stats.scope.boughtAtRangeBangkok.start ?? '—'} —{' '}
                {stats.scope.boughtAtRangeBangkok.end ?? '—'}
              </p>
            )}

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
