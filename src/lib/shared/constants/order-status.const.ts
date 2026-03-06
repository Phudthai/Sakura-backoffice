export const ORDER_STATUS = {
  DRAFT: 'DRAFT',
  PENDING_PAYMENT: 'PENDING_PAYMENT',
  PAID: 'PAID',
  PROCESSING: 'PROCESSING',
  PURCHASED: 'PURCHASED',
  SHIPPED_TO_TH: 'SHIPPED_TO_TH',
  ARRIVED_TH: 'ARRIVED_TH',
  READY_TO_SHIP: 'READY_TO_SHIP',
  SHIPPED_TO_CUSTOMER: 'SHIPPED_TO_CUSTOMER',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED',
} as const

export type OrderStatus = (typeof ORDER_STATUS)[keyof typeof ORDER_STATUS]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  DRAFT: 'ร่าง',
  PENDING_PAYMENT: 'รอชำระเงิน',
  PAID: 'ชำระเงินแล้ว',
  PROCESSING: 'กำลังดำเนินการ',
  PURCHASED: 'ซื้อเรียบร้อยแล้ว',
  SHIPPED_TO_TH: 'จัดส่งมาไทยแล้ว',
  ARRIVED_TH: 'ถึงไทยแล้ว',
  READY_TO_SHIP: 'พร้อมส่ง',
  SHIPPED_TO_CUSTOMER: 'กำลังจัดส่ง',
  COMPLETED: 'เสร็จสิ้น',
  CANCELLED: 'ยกเลิก',
  REFUNDED: 'คืนเงินแล้ว',
}

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  DRAFT: 'gray',
  PENDING_PAYMENT: 'yellow',
  PAID: 'green',
  PROCESSING: 'blue',
  PURCHASED: 'blue',
  SHIPPED_TO_TH: 'indigo',
  ARRIVED_TH: 'purple',
  READY_TO_SHIP: 'purple',
  SHIPPED_TO_CUSTOMER: 'cyan',
  COMPLETED: 'green',
  CANCELLED: 'red',
  REFUNDED: 'orange',
}

export function canCancelOrder(status: OrderStatus): boolean {
  return ([ORDER_STATUS.DRAFT, ORDER_STATUS.PENDING_PAYMENT, ORDER_STATUS.PAID] as OrderStatus[]).includes(status)
}

export function isOrderFinal(status: OrderStatus): boolean {
  return ([ORDER_STATUS.COMPLETED, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUNDED] as OrderStatus[]).includes(status)
}

export function requiresPayment(status: OrderStatus): boolean {
  return status === ORDER_STATUS.PENDING_PAYMENT
}
