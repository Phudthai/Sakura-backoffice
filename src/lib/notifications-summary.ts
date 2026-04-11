import { API_BACKOFFICE_PREFIX } from '@/lib/api-config'

export interface AirSeaCounts {
  air: number
  sea: number
}

export interface NotificationsSummaryData {
  pendingSlips: number
  pendingBids: number
  lotsMissingEndLotAt: AirSeaCounts
  lotsMissingArriveAt: AirSeaCounts
}

function sumAirSea(c: AirSeaCounts | undefined): number {
  if (!c) return 0
  const a = typeof c.air === 'number' && Number.isFinite(c.air) ? c.air : 0
  const s = typeof c.sea === 'number' && Number.isFinite(c.sea) ? c.sea : 0
  return a + s
}

export function countForNavSubHref(
  href: string,
  data: NotificationsSummaryData | null,
): number {
  if (!data) return 0
  const path = href.split('?')[0] ?? href
  if (path === '/slips/pending') return data.pendingSlips
  if (path === '/auctions/pending-bids') return data.pendingBids
  return 0
}

/** ผลรวมตัวเลข lot ทั้งหมดใน summary (อาจนับ lot เดียวซ้ำหลายหมวดตาม backend) */
export function totalLotNotificationCount(data: NotificationsSummaryData): number {
  return sumAirSea(data.lotsMissingEndLotAt) + sumAirSea(data.lotsMissingArriveAt)
}

/** สำหรับ title tooltip บนเมนูล็อตการจัดส่ง */
export function formatLotsNotificationTooltip(data: NotificationsSummaryData): string {
  const line = (c: AirSeaCounts) => `Air ${c.air} · Sea ${c.sea}`
  return [
    `ยังไม่มีวันตัดรอบ (end_lot_at): ${line(data.lotsMissingEndLotAt)}`,
    `ยังไม่มีวันถึงไทย (arrive_at): ${line(data.lotsMissingArriveAt)}`,
  ].join('\n')
}

export async function fetchNotificationsSummary(): Promise<NotificationsSummaryData | null> {
  try {
    const res = await fetch(`${API_BACKOFFICE_PREFIX}/notifications/summary`, {
      credentials: 'include',
    })
    const json = (await res.json()) as {
      success?: boolean
      data?: NotificationsSummaryData
    }
    if (!res.ok || !json.success || json.data == null) return null
    return json.data
  } catch {
    return null
  }
}
