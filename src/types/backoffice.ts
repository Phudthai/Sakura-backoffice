export interface AdminOrder {
  id: string
  orderNumber: string
  customerName: string
  customerEmail: string
  status: string
  totalJPY: number
  totalTHB: number
  itemCount: number
  createdAt: string
}

export interface AdminCustomer {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
  isEmailVerified: boolean
  orderCount: number
  createdAt: string
}

export interface AdminProduct {
  id: string
  name: string
  price: number
  imageUrl: string
  condition: string
  isAuction: boolean
  status: 'active' | 'sold' | 'draft'
  createdAt: string
}

export interface AdminAuction {
  id: string
  productName: string
  imageUrl: string
  startingPrice: number
  currentBid: number
  bidCount: number
  endTimeISO: string
  status: 'active' | 'ended' | 'cancelled'
}

export interface DashboardStats {
  pendingOrders: number
  processingOrders: number
  shippedOrders: number
  completedOrders: number
  totalRevenueTHB: number
  totalCustomers: number
}
