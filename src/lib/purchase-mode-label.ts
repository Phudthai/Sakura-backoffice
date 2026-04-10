/**
 * แปลงค่า purchase_mode จาก API (AUCTION | BUYOUT | …) เป็นข้อความภาษาไทยใน UI
 */
export function purchaseModeLabelTh(mode: string | null | undefined): string {
  if (mode == null || mode === '') return '—'
  const u = String(mode).trim().toUpperCase()
  if (u === 'AUCTION') return 'ประมูล'
  if (u === 'BUYOUT') return 'กดเว็ป'
  if (u === 'ALL') return 'ทั้งหมด'
  return String(mode)
}
