import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

/** กดเว็ป: Yahoo / Mercari / เว็บทั่วไป */
export type BuyoutFormTab = 'yahoo' | 'mercari' | 'general_web'

export type IntlShippingChoice = 'air' | 'sea'

export async function postAuctionRequest(
  body: Record<string, unknown>
): Promise<{ id: number; data: unknown }> {
  const res = await fetch(`${API_BACKOFFICE_PREFIX}/purchase-requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error?.message ?? 'บันทึกไม่สำเร็จ')
  }
  return { id: json.data.id, data: json.data }
}

export async function submitBuyoutFlow(payload: {
  buyoutTab: BuyoutFormTab
  username: string
  url: string
  transferredYen?: number
  intl_shipping_type: 'air' | 'sea'
  productTitle?: string
  siteName?: string
  priceYen?: number
}): Promise<{ id: number; data: unknown }> {
  const base: Record<string, unknown> = {
    purchase_mode: 'BUYOUT' as const,
    username: payload.username.trim(),
    url: payload.url.trim(),
    intl_shipping_type: payload.intl_shipping_type,
    buyoutSource: payload.buyoutTab,
  }
  if (payload.transferredYen != null && Number.isFinite(payload.transferredYen)) {
    base.transferredYen = payload.transferredYen
  }
  if (payload.buyoutTab === 'yahoo' || payload.buyoutTab === 'mercari') {
    return postAuctionRequest(base)
  }
  return postAuctionRequest({
    ...base,
    productTitle: payload.productTitle?.trim(),
    siteName: payload.siteName?.trim(),
    firstBidPrice: payload.priceYen != null ? Number(payload.priceYen) : undefined,
  })
}
