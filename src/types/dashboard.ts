// ---------------------------------------------------------------------------
// Dashboard Types
// ---------------------------------------------------------------------------

/** Bid status from the current user's perspective */
export type BidStatus = 'winning' | 'outbid' | 'won' | 'lost'

/** A product the user is actively bidding on */
export interface UserBid {
  id: string
  productId: string
  productName: string
  imageUrl: string
  /** The user's highest bid */
  myBid: number
  /** Current highest bid overall */
  currentBid: number
  /** Total number of bids on this item */
  bidCount: number
  /** Auction end time ISO */
  endTimeISO: string
  /** Whether the auction has ended */
  auctionEnded: boolean
  /** User's bid status */
  status: BidStatus
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export interface OrderItem {
  id: string
  productName: string
  productUrl: string
  imageUrl?: string
  priceJPY: number
  quantity: number
  variant?: string
}

export type OrderStatus =
  | 'DRAFT'
  | 'PENDING_PAYMENT'
  | 'PAID'
  | 'PROCESSING'
  | 'PURCHASED'
  | 'SHIPPED_TO_TH'
  | 'ARRIVED_TH'
  | 'READY_TO_SHIP'
  | 'SHIPPED_TO_CUSTOMER'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'REFUNDED'

export type TrackingStatus =
  | 'ORDER_PLACED'
  | 'PROCESSING'
  | 'PURCHASED'
  | 'PACKED'
  | 'SHIPPED_FROM_JP'
  | 'IN_TRANSIT'
  | 'CUSTOMS_CLEARANCE'
  | 'ARRIVED_WAREHOUSE'
  | 'READY_FOR_DELIVERY'
  | 'OUT_FOR_DELIVERY'
  | 'DELIVERED'
  | 'FAILED_DELIVERY'

export interface TrackingEvent {
  id: string
  status: TrackingStatus
  description: string
  location?: string
  eventAt: string
}

export interface OrderTracking {
  id: string
  status: TrackingStatus
  trackingNumber?: string
  carrier?: string
  estimatedDelivery?: string
  deliveredAt?: string
  events: TrackingEvent[]
}

export interface UserOrder {
  id: string
  orderNumber: string
  status: OrderStatus
  totalJPY: number
  totalTHB: number
  exchangeRate: number
  serviceFee: number
  shippingCost: number
  discount: number
  discountCode?: string
  items: OrderItem[]
  tracking?: OrderTracking
  paidAt?: string
  completedAt?: string
  cancelledAt?: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Addresses
// ---------------------------------------------------------------------------

export interface UserAddress {
  id: string
  label?: string
  fullAddress: string
  province: string
  district: string
  postalCode: string
  phone: string
  isDefault: boolean
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type NotificationType =
  | 'ORDER_UPDATE'
  | 'PAYMENT_UPDATE'
  | 'TRACKING_UPDATE'
  | 'SYSTEM'
  | 'PROMOTION'

export interface UserNotification {
  id: string
  type: NotificationType
  title: string
  message: string
  resourceId?: string
  isRead: boolean
  readAt?: string
  createdAt: string
}

