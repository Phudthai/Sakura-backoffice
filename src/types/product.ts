/**
 * Product listing item
 *
 * Represents a product from a Japanese marketplace (Mercari, Rakuten, Yahoo Auction).
 */
export interface Product {
  /** Unique product ID */
  id: string

  /** Product display name (Japanese or English) */
  name: string

  /** Price in Japanese Yen */
  price: number

  /** Product thumbnail image URL */
  imageUrl?: string

  /** Item condition label */
  condition?: string

  /** Source marketplace */
  source?: 'mercari' | 'rakuten' | 'yahoo'

  /** Whether this is an auction listing */
  isAuction?: boolean

  /** Number of bids (for auction items) */
  bidCount?: number

  /** Auction end time ISO string — used for countdown on listing cards */
  endTimeISO?: string
}

/**
 * A single bid entry in the bid history.
 */
export interface BidEntry {
  /** Unique bid ID */
  id: string

  /** Masked bidder display name, e.g. "u***4" */
  bidderName: string

  /** Bid amount in JPY */
  amount: number

  /** Display timestamp, e.g. "2 minutes ago" */
  timestamp: string

  /** Whether this is the current winning (highest) bid */
  isWinning: boolean
}

/**
 * Extended product with full detail fields for the detail page.
 */
export interface ProductDetail extends Product {
  /** Multiple image URLs for the gallery */
  images: string[]

  /** Full description text */
  description: string

  /** Breadcrumb category path, e.g. ["Games, toys, and goods", "Trading Cards", "Pokemon Card Game"] */
  categories: string[]

  /** Detailed condition explanation */
  conditionDescription: string

  /** Shipping cost label */
  shippingCost: string

  /** Shipping method name */
  shippingMethod: string

  /** Shipping region */
  shippingRegion: string

  /** Shipping days estimate */
  shippingDays: string

  /** Auction end time display string */
  endTime?: string

  /** Number of likes / hearts */
  likeCount: number

  /** Number of shares */
  shareCount: number

  /** When the item was posted (display string) */
  postedAt: string

  /** Starting / opening price for auction items */
  startingPrice?: number

  /** Current highest bid amount */
  currentBid?: number

  /** List of bid entries (newest first) */
  bidHistory?: BidEntry[]

  /** ISO date string for countdown timer */
  endTimeISO?: string

  /** Whether the auction has ended */
  auctionEnded?: boolean
}

/**
 * Filter option for sidebar
 */
export interface FilterOption {
  label: string
  value: string
  count?: number
}

/**
 * Filter group (collapsible section in sidebar)
 */
export interface FilterGroup {
  id: string
  label: string
  options: FilterOption[]
}
