import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

/** กดเว็ป: Yahoo / Mercari / เว็บทั่วไป */
export type BuyoutFormTab = 'yahoo' | 'mercari' | 'general_web'

export type IntlShippingChoice = 'air' | 'sea'

export type ClientEntry = 'first_buyout' | 'not_arrived_japan'

export type BackofficeUserListItem = {
  id: number
  userCode?: string
  username?: string
  email?: string
  name?: string
  phone?: string | null
  role?: string
  createdAt?: string
}

async function parseJsonResponse(res: Response): Promise<{
  success?: boolean
  data?: { id: number }
  error?: { message?: string }
}> {
  return res.json() as Promise<{
    success?: boolean
    data?: { id: number }
    error?: { message?: string }
  }>
}

export async function postPurchaseRequestJson(
  body: Record<string, unknown>
): Promise<{ id: number; data: unknown }> {
  const res = await fetch(`${API_BACKOFFICE_PREFIX}/purchase-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await parseJsonResponse(res)
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'บันทึกไม่สำเร็จ')
  }
  return { id: json.data!.id, data: json.data }
}

/** multipart: field `payload` = JSON string, optional file field `slip` */
export async function postPurchaseRequestMultipart(
  payload: Record<string, unknown>,
  slip: File
): Promise<{ id: number; data: unknown }> {
  const form = new FormData()
  form.set('payload', JSON.stringify(payload))
  form.set('slip', slip)
  const res = await fetch(`${API_BACKOFFICE_PREFIX}/purchase-requests`, {
    method: 'POST',
    credentials: 'include',
    body: form,
  })
  const json = await parseJsonResponse(res)
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'บันทึกไม่สำเร็จ')
  }
  return { id: json.data!.id, data: json.data }
}

export async function submitBuyoutFlow(payload: {
  buyoutTab: BuyoutFormTab
  username?: string
  url: string
  intl_shipping_type: IntlShippingChoice
  client_entry: ClientEntry
  /** THB — ถ้า > 0 ต้องแนบ slip */
  paidThb?: number
  slip?: File | null
  product_title?: string
  site_name?: string
  /** JPY — BUYOUT general_web */
  first_bid_price?: number
  /** JPY — Mercari */
  item_price_jpy?: number
}): Promise<{ id: number; data: unknown }> {
  const base: Record<string, unknown> = {
    purchase_mode: 'BUYOUT',
    buyout_source: payload.buyoutTab,
    url: payload.url.trim(),
    intl_shipping_type: payload.intl_shipping_type,
    client_entry: payload.client_entry,
  }
  if (payload.username?.trim()) {
    base.username = payload.username.trim()
  }
  if (payload.buyoutTab === 'mercari' && payload.item_price_jpy != null && Number.isFinite(payload.item_price_jpy)) {
    base.item_price_jpy = Math.round(payload.item_price_jpy)
  }
  if (payload.buyoutTab === 'general_web') {
    base.product_title = payload.product_title?.trim()
    base.site_name = payload.site_name?.trim()
    if (payload.first_bid_price != null) {
      base.first_bid_price = payload.first_bid_price
    }
  }
  const paid = payload.paidThb != null && Number.isFinite(payload.paidThb) ? Math.round(payload.paidThb) : 0
  if (paid > 0) {
    base.paid = paid
    if (!payload.slip) {
      throw new Error('กรุณาแนบสลิปเมื่อระบุจำนวนเงินที่โอน (บาท)')
    }
    return postPurchaseRequestMultipart(base, payload.slip)
  }
  return postPurchaseRequestJson(base)
}

export type AuctionIntent = 'open_bid' | 'paid_instant'

export async function submitAuctionFirstFlow(payload: {
  auction_source: 'yahoo' | 'mercari'
  url: string
  intl_shipping_type: IntlShippingChoice
  username?: string
  intent: AuctionIntent
  /** JPY — เมื่อ intent === open_bid */
  first_bid_price?: number
  /** JPY — Mercari เมื่อ intent === open_bid */
  item_price_jpy?: number
  /** THB — เมื่อ intent === paid_instant */
  paid?: number
  slip?: File | null
}): Promise<{ id: number; data: unknown }> {
  const base: Record<string, unknown> = {
    purchase_mode: 'AUCTION',
    auction_source: payload.auction_source,
    url: payload.url.trim(),
    intl_shipping_type: payload.intl_shipping_type,
  }
  if (payload.username?.trim()) {
    base.username = payload.username.trim()
  }

  if (payload.intent === 'paid_instant') {
    const paid = payload.paid != null && Number.isFinite(payload.paid) ? Math.round(payload.paid) : 0
    if (paid <= 0) {
      throw new Error('กรุณาระบุจำนวนเงินที่ลูกค้าโอน (บาท)')
    }
    base.paid = paid
    if (payload.auction_source === 'mercari') {
      if (payload.item_price_jpy == null || !Number.isFinite(payload.item_price_jpy)) {
        throw new Error('Mercari ต้องระบุราคารายการ (เยน)')
      }
      base.item_price_jpy = Math.round(payload.item_price_jpy)
    }
    if (!payload.slip) {
      throw new Error('กรุณาแนบสลิปเมื่อมีการชำระเงิน')
    }
    return postPurchaseRequestMultipart(base, payload.slip)
  }

  const open = payload.first_bid_price != null && Number.isFinite(payload.first_bid_price) ? Math.round(payload.first_bid_price) : 0
  if (open <= 0) {
    throw new Error('กรุณาระบุราคาเปิดประมูล (เยน)')
  }
  base.first_bid_price = open
  if (payload.auction_source === 'mercari') {
    if (payload.item_price_jpy == null || !Number.isFinite(payload.item_price_jpy)) {
      throw new Error('Mercari ต้องระบุราคารายการ (เยน)')
    }
    base.item_price_jpy = Math.round(payload.item_price_jpy)
  }
  return postPurchaseRequestJson(base)
}
