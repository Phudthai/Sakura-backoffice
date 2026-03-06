export interface OrderTotalBreakdown {
  subtotalJPY: number
  subtotalTHB: number
  serviceFee: number
  shippingCost: number
  discount: number
  total: number
}

export interface CreateOrderDto {
  items: CreateOrderItemDto[]
  shippingAddressId: string
  discountCode?: string
  notes?: string
}

export interface CreateOrderItemDto {
  productName: string
  productUrl: string
  imageUrl?: string
  priceJPY: number
  quantity: number
  variant?: string
  color?: string
  notes?: string
}

export interface UpdateOrderDto {
  shippingAddressId?: string
  notes?: string
}
