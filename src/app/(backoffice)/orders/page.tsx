'use client'

import { MOCK_ORDERS } from '@/lib/backoffice-mock'
import { formatPrice } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  PENDING_PAYMENT: 'bg-yellow-100 text-yellow-800',
  PROCESSING: 'bg-blue-100 text-blue-800',
  SHIPPED_TO_TH: 'bg-indigo-100 text-indigo-800',
  COMPLETED: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
}

export default function OrdersPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">Orders</h1>
        <span className="text-sm text-muted-dark">{MOCK_ORDERS.length} orders</span>
      </div>

      <div className="rounded-xl border border-card-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted-dark bg-sakura-50">
                <th className="px-5 py-3 font-medium">Order #</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium text-right">Total (JPY)</th>
                <th className="px-5 py-3 font-medium text-right">Total (THB)</th>
                <th className="px-5 py-3 font-medium text-center">Items</th>
                <th className="px-5 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_ORDERS.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-sakura-900">
                    {order.orderNumber}
                  </td>
                  <td className="px-5 py-3">
                    <div>
                      <p className="text-sakura-900">{order.customerName}</p>
                      <p className="text-xs text-muted">{order.customerEmail}</p>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[order.status] ?? 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {order.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">¥{formatPrice(order.totalJPY)}</td>
                  <td className="px-5 py-3 text-right font-medium">
                    ฿{formatPrice(order.totalTHB)}
                  </td>
                  <td className="px-5 py-3 text-center">{order.itemCount}</td>
                  <td className="px-5 py-3 text-muted-dark">
                    {new Date(order.createdAt).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
