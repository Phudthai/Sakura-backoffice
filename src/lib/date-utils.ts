const TZ = 'Asia/Bangkok'

export function formatDateBangkok(iso: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('th-TH', {
    timeZone: TZ,
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function toDateInputValueBangkok(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ }) // YYYY-MM-DD
}

export function dateStrToBangkokISO(dateStr: string, endOfDay?: boolean): string {
  const time = endOfDay ? 'T23:59:59+07:00' : 'T00:00:00+07:00'
  return new Date(dateStr + time).toISOString()
}
