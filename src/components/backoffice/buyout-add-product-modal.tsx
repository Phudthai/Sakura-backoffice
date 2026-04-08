'use client'

import { useState, useEffect } from 'react'
import { X, Link2, Send } from 'lucide-react'
import {
  submitBuyoutFlow,
  type BuyoutFormTab,
  type IntlShippingChoice,
} from '@/lib/buyout-request'

type Props = {
  open: boolean
  onClose: () => void
  /** เรียกหลังสร้างคำขอสำเร็จ (เช่น refresh รายการ) */
  onSuccess: () => void
  /** ค่าเริ่มต้นช่องชื่อลูกค้า (เช่น จาก filter ชื่อลูกค้าหน้ารายการ) */
  initialUsername?: string
}

export default function BuyoutAddProductModal({
  open,
  onClose,
  onSuccess,
  initialUsername = '',
}: Props) {
  const [url, setUrl] = useState('')
  const [intlShippingType, setIntlShippingType] = useState<IntlShippingChoice | null>(null)
  const [username, setUsername] = useState('')
  const [transferredYen, setTransferredYen] = useState('')
  const [buyoutTab, setBuyoutTab] = useState<BuyoutFormTab>('yahoo')
  const [productTitle, setProductTitle] = useState('')
  const [siteName, setSiteName] = useState('')
  const [priceYen, setPriceYen] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    if (!open) return
    setFormError('')
    setUrl('')
    setIntlShippingType(null)
    setUsername(initialUsername.trim())
    setTransferredYen('')
    setBuyoutTab('yahoo')
    setProductTitle('')
    setSiteName('')
    setPriceYen('')
  }, [open, initialUsername])

  const handleClose = () => {
    onClose()
    setFormError('')
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
      if (!uname) {
        setFormError('กรุณากรอกชื่อลูกค้า')
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
      handleClose()
      onSuccess()
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'บันทึกไม่สำเร็จ')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={handleClose}
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-xl mx-4 bg-white rounded-2xl border border-card-border shadow-card p-6 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-sakura-900">กดเว็ป</h2>
          <button
            type="button"
            onClick={handleClose}
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
              ชื่อลูกค้า <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="ชื่อลูกค้า"
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
                  name="intl-shipping-buyout-add-product"
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
                  name="intl-shipping-buyout-add-product"
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
      </div>
    </div>
  )
}
