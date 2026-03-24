'use client'

import { useState, useCallback } from 'react'
import Swal from 'sweetalert2'
import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'
import { Loader2, Plus, Trash2, Save, Settings, X, Banknote, Package } from 'lucide-react'

interface JpyThbTier {
  id?: number
  minJpy: number
  maxJpy: number | null
  rate: number
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

type EditableTier = Omit<JpyThbTier, 'id' | 'createdAt' | 'updatedAt'>

function tiersToEditable(tiers: JpyThbTier[]): EditableTier[] {
  return [...tiers]
    .sort((a, b) => a.sortOrder - b.sortOrder || (a.id ?? 0) - (b.id ?? 0))
    .map((t, i) => ({
      minJpy: t.minJpy,
      maxJpy: t.maxJpy,
      rate: t.rate,
      sortOrder: i,
    }))
}

interface ShippingGramRatesData {
  air: { bahtPerGram: number }
  sea: { bahtPerGram: number }
}

export default function SettingsPage() {
  const [exchangeModalOpen, setExchangeModalOpen] = useState(false)
  const [gramModalOpen, setGramModalOpen] = useState(false)
  const [tiers, setTiers] = useState<EditableTier[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [airBahtPerGram, setAirBahtPerGram] = useState('')
  const [seaBahtPerGram, setSeaBahtPerGram] = useState('')
  const [loadingGramRates, setLoadingGramRates] = useState(false)
  const [savingGramRates, setSavingGramRates] = useState(false)
  const [gramError, setGramError] = useState('')
  const [gramSuccess, setGramSuccess] = useState('')

  const fetchGramRates = useCallback(async () => {
    setLoadingGramRates(true)
    setGramError('')
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/shipping-gram-rates`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data) {
        const d = json.data as {
          air?: { bahtPerGram?: number }
          sea?: { bahtPerGram?: number }
        }
        const air = d.air?.bahtPerGram
        const sea = d.sea?.bahtPerGram
        setAirBahtPerGram(typeof air === 'number' && !Number.isNaN(air) ? String(air) : '')
        setSeaBahtPerGram(typeof sea === 'number' && !Number.isNaN(sea) ? String(sea) : '')
      } else {
        setGramError(json.error?.message ?? 'โหลดค่าขนส่งต่อกรัมไม่สำเร็จ')
      }
    } catch {
      setGramError('Network error')
    } finally {
      setLoadingGramRates(false)
    }
  }, [])

  const openGramModal = () => {
    setGramModalOpen(true)
    setGramSuccess('')
    setGramError('')
    void fetchGramRates()
  }

  const closeGramModal = () => {
    setGramModalOpen(false)
    setGramError('')
    setGramSuccess('')
  }

  const saveGramRates = async () => {
    const air = parseFloat(airBahtPerGram)
    const sea = parseFloat(seaBahtPerGram)
    if (Number.isNaN(air) || Number.isNaN(sea) || air < 0 || sea < 0) {
      setGramError('กรอกตัวเลขบาทต่อกรัม (ไม่ติดลบ) ให้ครบทั้ง Air และ Sea')
      setGramSuccess('')
      return
    }

    const { isConfirmed } = await Swal.fire({
      title: 'ยืนยันการบันทึก?',
      text: 'ต้องการบันทึกอัตราบาทต่อกรัม (Air / Sea) ตามที่แก้ไขหรือไม่',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
    })
    if (!isConfirmed) return

    setSavingGramRates(true)
    setGramError('')
    setGramSuccess('')
    const body: ShippingGramRatesData = {
      air: { bahtPerGram: air },
      sea: { bahtPerGram: sea },
    }
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/shipping-gram-rates`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success) {
        const d = json.data as Partial<ShippingGramRatesData> | undefined
        if (d?.air?.bahtPerGram != null) setAirBahtPerGram(String(d.air.bahtPerGram))
        if (d?.sea?.bahtPerGram != null) setSeaBahtPerGram(String(d.sea.bahtPerGram))
        closeGramModal()
        void Swal.fire({
          icon: 'success',
          title: 'บันทึกเรียบร้อย',
          timer: 2000,
          showConfirmButton: false,
        })
      } else {
        const msg =
          json.error?.message ??
          json.message ??
          'บันทึกไม่สำเร็จ'
        setGramError(msg)
      }
    } catch {
      setGramError('Network error')
    } finally {
      setSavingGramRates(false)
    }
  }

  const fetchTiers = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/exchange-rates/jpy-thb`, {
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data?.tiers) {
        const list = json.data.tiers as JpyThbTier[]
        setTiers(list.length ? tiersToEditable(list) : [{ minJpy: 0, maxJpy: null, rate: 0.265, sortOrder: 0 }])
      } else {
        setError(json.error?.message ?? 'โหลดเรทไม่สำเร็จ')
      }
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }, [])

  const openExchangeModal = () => {
    setExchangeModalOpen(true)
    setSuccess('')
    setError('')
    fetchTiers()
  }

  const closeExchangeModal = () => {
    setExchangeModalOpen(false)
    setError('')
    setSuccess('')
  }

  const updateTier = (index: number, patch: Partial<EditableTier>) => {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, ...patch } : t))
    )
  }

  const addTier = () => {
    setTiers((prev) => {
      if (prev.length === 0) {
        return [{ minJpy: 0, maxJpy: null, rate: 0.265, sortOrder: 0 }]
      }
      const last = prev[prev.length - 1]
      if (last.maxJpy === null) {
        const splitAt = last.minJpy + 1200
        const updated = [
          ...prev.slice(0, -1),
          { ...last, maxJpy: splitAt },
          { minJpy: splitAt, maxJpy: null, rate: last.rate, sortOrder: 0 },
        ]
        return updated.map((t, i) => ({ ...t, sortOrder: i }))
      }
      const nextMin = last.maxJpy
      return [...prev, { minJpy: nextMin, maxJpy: null, rate: last.rate, sortOrder: 0 }].map((t, i) => ({
        ...t,
        sortOrder: i,
      }))
    })
  }

  const removeTier = (index: number) => {
    setTiers((prev) => {
      if (prev.length <= 1) return prev
      const next = prev.filter((_, i) => i !== index).map((t, i) => ({ ...t, sortOrder: i }))
      if (next[0]) next[0] = { ...next[0], minJpy: 0 }
      if (next[next.length - 1]) {
        next[next.length - 1] = { ...next[next.length - 1], maxJpy: null }
      }
      return next
    })
  }

  const handleSave = async () => {
    const { isConfirmed } = await Swal.fire({
      title: 'ยืนยันการบันทึก?',
      text: 'ต้องการบันทึกเรท JPY → THB ตามที่แก้ไขหรือไม่',
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'ยืนยัน',
      cancelButtonText: 'ยกเลิก',
    })
    if (!isConfirmed) return

    setSaving(true)
    setError('')
    setSuccess('')
    const body = {
      tiers: tiers.map((t, i) => ({
        minJpy: Number(t.minJpy),
        maxJpy: t.maxJpy === null || t.maxJpy === (undefined as unknown as null) ? null : Number(t.maxJpy),
        rate: Number(t.rate),
        sortOrder: i,
      })),
    }
    try {
      const res = await fetch(`${API_BACKOFFICE_PREFIX}/exchange-rates/jpy-thb`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })
      const json = await res.json()
      if (json.success && json.data?.tiers) {
        setTiers(tiersToEditable(json.data.tiers))
        closeExchangeModal()
        void Swal.fire({
          icon: 'success',
          title: 'บันทึกเรียบร้อย',
          timer: 2000,
          showConfirmButton: false,
        })
      } else {
        const msg =
          json.error?.message ??
          json.message ??
          (Array.isArray(json.error?.details)
            ? json.error.details.map((d: { message?: string }) => d.message).join(', ')
            : 'บันทึกไม่สำเร็จ')
        setError(msg)
      }
    } catch {
      setError('Network error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-sakura-900 tracking-tight">Settings</h1>
        <p className="mt-1 text-sm text-muted">ตั้งค่าระบบ (เพิ่มรายการอื่นได้ในอนาคต)</p>
      </div>

      <div className="rounded-2xl border border-sakura-200/60 bg-white shadow-card p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-sakura-500 mb-4">การเงิน</h2>
        <div className="flex flex-col gap-5 sm:flex-row sm:flex-wrap sm:items-start">
          <div>
            <button
              type="button"
              onClick={openExchangeModal}
              className="inline-flex items-center gap-2 rounded-xl border border-sakura-200 bg-sakura-50/50 px-5 py-3 text-sm font-semibold text-sakura-900 hover:bg-sakura-100/80 hover:border-sakura-300 transition-colors"
            >
              <Banknote className="h-5 w-5 text-indigo-600" />
              ตั้งค่าหน่วยแปลงเงิน
            </button>
            <p className="mt-2 text-xs text-muted max-w-xs">เรท JPY → THB แบบ tier ตามช่วงเยน</p>
          </div>
          <div>
            <button
              type="button"
              onClick={openGramModal}
              className="inline-flex items-center gap-2 rounded-xl border border-sakura-200 bg-sakura-50/50 px-5 py-3 text-sm font-semibold text-sakura-900 hover:bg-sakura-100/80 hover:border-sakura-300 transition-colors"
            >
              <Package className="h-5 w-5 text-sky-600" />
              ตั้งค่าขนส่งต่อกรัม (Air / Sea)
            </button>
            <p className="mt-2 text-xs text-muted max-w-xs">
              บาทต่อกรัมสำหรับคำนวณค่าขนส่งระหว่างประเทศ
            </p>
          </div>
        </div>
      </div>

      {exchangeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeExchangeModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-3xl max-h-[90vh] flex flex-col bg-white rounded-2xl border border-card-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-sakura-200 bg-sakura-50/80 flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <Settings className="h-5 w-5 text-sakura-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-sakura-900">เรท JPY → THB (tier)</h2>
                  <p className="text-xs text-muted mt-1">
                    ช่วง [minJpy, maxJpy) — tier สุดท้าย = ∞ · แปลงบาทใช้ Math.ceil(jpy × rate)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeExchangeModal}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {error && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  {error}
                </div>
              )}
              {success && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm">
                  {success}
                </div>
              )}

              {loading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted" />
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm min-w-[560px]">
                      <thead>
                        <tr className="border-b border-sakura-200 text-left">
                          <th className="pb-3 pr-3 font-semibold text-sakura-700">ลำดับ</th>
                          <th className="pb-3 pr-3 font-semibold text-sakura-700">เยนขั้นต่ำ</th>
                          <th className="pb-3 pr-3 font-semibold text-sakura-700">เยนสูงสุด</th>
                          <th className="pb-3 pr-3 font-semibold text-sakura-700">อัตราแลกเปลี่ยน</th>
                          <th className="pb-3 w-10" />
                        </tr>
                      </thead>
                      <tbody>
                        {tiers.map((tier, index) => {
                          const isLast = index === tiers.length - 1
                          return (
                            <tr key={index} className="border-b border-sakura-100">
                              <td className="py-2.5 pr-3 text-muted">{index + 1}</td>
                              <td className="py-2.5 pr-3">
                                <input
                                  type="number"
                                  min={0}
                                  value={tier.minJpy}
                                  onChange={(e) =>
                                    updateTier(index, { minJpy: Number(e.target.value) || 0 })
                                  }
                                  className="w-24 rounded-lg border border-sakura-200 px-2 py-1.5 font-mono text-xs"
                                  disabled={index === 0}
                                />
                              </td>
                              <td className="py-2.5 pr-3">
                                {isLast ? (
                                  <span className="text-muted text-xs">∞ (ไม่จำกัด)</span>
                                ) : (
                                  <input
                                    type="number"
                                    min={0}
                                    value={tier.maxJpy ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      updateTier(index, {
                                        maxJpy: v === '' ? null : Number(v),
                                      })
                                    }}
                                    className="w-24 rounded-lg border border-sakura-200 px-2 py-1.5 font-mono text-xs"
                                  />
                                )}
                              </td>
                              <td className="py-2.5 pr-3">
                                <input
                                  type="number"
                                  step="0.000001"
                                  min={0}
                                  value={tier.rate}
                                  onChange={(e) =>
                                    updateTier(index, { rate: Number(e.target.value) || 0 })
                                  }
                                  className="w-28 rounded-lg border border-sakura-200 px-2 py-1.5 font-mono text-xs"
                                />
                              </td>
                              <td className="py-2.5">
                                <button
                                  type="button"
                                  onClick={() => removeTier(index)}
                                  disabled={tiers.length <= 1}
                                  className="p-1 rounded-lg text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                                  title="ลบ tier"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={addTier}
                      className="inline-flex items-center gap-2 rounded-lg border border-sakura-200 px-3 py-2 text-sm font-medium text-sakura-700 hover:bg-sakura-50"
                    >
                      <Plus className="h-4 w-4" />
                      เพิ่ม tier
                    </button>
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving || tiers.length === 0}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {saving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      บันทึกเรท
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {gramModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeGramModal}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col bg-white rounded-2xl border border-card-border shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-sakura-200 bg-sakura-50/80 flex items-start justify-between gap-4 shrink-0">
              <div className="flex items-start gap-3 min-w-0">
                <Package className="h-5 w-5 text-sky-600 shrink-0 mt-0.5" />
                <div>
                  <h2 className="text-base font-bold text-sakura-900">ขนส่งต่างประเทศ (บาทต่อกรัม)</h2>
                  <p className="text-xs text-muted mt-1">
                    Air และ Sea — ใช้คำนวณจากน้ำหนัก (กรัม)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeGramModal}
                className="rounded-lg p-1.5 text-muted hover:bg-sakura-100 hover:text-sakura-900"
                aria-label="ปิด"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {gramError && (
                <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-100 text-red-700 text-sm">
                  {gramError}
                </div>
              )}
              {gramSuccess && (
                <div className="mb-4 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-sm">
                  {gramSuccess}
                </div>
              )}

              {loadingGramRates ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted" />
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-sakura-600 mb-1">Air (บาท/ก.)</label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={airBahtPerGram}
                      onChange={(e) => {
                        setAirBahtPerGram(e.target.value)
                        setGramSuccess('')
                      }}
                      className="w-full rounded-lg border border-sakura-200 px-3 py-2.5 font-mono text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-sakura-600 mb-1">Sea (บาท/ก.)</label>
                    <input
                      type="number"
                      step="any"
                      min={0}
                      value={seaBahtPerGram}
                      onChange={(e) => {
                        setSeaBahtPerGram(e.target.value)
                        setGramSuccess('')
                      }}
                      className="w-full rounded-lg border border-sakura-200 px-3 py-2.5 font-mono text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div className="pt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void saveGramRates()}
                      disabled={savingGramRates}
                      className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                      {savingGramRates ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      บันทึก
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
