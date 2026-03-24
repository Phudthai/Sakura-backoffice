"use client";

import {
  ShoppingCart,
  Clock,
  Truck,
  CheckCircle,
  DollarSign,
  Users,
} from "lucide-react";
import { MOCK_STATS, MOCK_ORDERS } from "@/lib/backoffice-mock";
import { formatPrice } from "@/lib/utils";
import { formatDateBangkok } from "@/lib/date-utils";

const STATUS_BADGE: Record<string, string> = {
  PENDING_PAYMENT: "bg-yellow-100 text-yellow-800",
  PROCESSING: "bg-blue-100 text-blue-800",
  SHIPPED_TO_TH: "bg-indigo-100 text-indigo-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-red-100 text-red-800",
};

export default function DashboardPage() {
  const stats = MOCK_STATS;
  const recentOrders = MOCK_ORDERS.slice(0, 5);

  const cards = [
    {
      label: "Pending",
      value: stats.pendingOrders,
      icon: Clock,
      color: "text-yellow-600 bg-yellow-50",
    },
    {
      label: "Processing",
      value: stats.processingOrders,
      icon: ShoppingCart,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Shipped",
      value: stats.shippedOrders,
      icon: Truck,
      color: "text-indigo-600 bg-indigo-50",
    },
    {
      label: "Completed",
      value: stats.completedOrders,
      icon: CheckCircle,
      color: "text-green-600 bg-green-50",
    },
    {
      label: "Revenue (THB)",
      value: `฿${formatPrice(stats.totalRevenueTHB)}`,
      icon: DollarSign,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Customers",
      value: stats.totalCustomers,
      icon: Users,
      color: "text-purple-600 bg-purple-50",
    },
  ];

  return (
    <div>
      <h1 className="text-xl font-semibold text-sakura-900 mb-6">Dashboard</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-card-border bg-white p-4 shadow-card"
          >
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`flex h-9 w-9 items-center justify-center rounded-lg ${card.color}`}
              >
                <card.icon className="h-4 w-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-sakura-900">{card.value}</p>
            <p className="text-xs text-muted-dark mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Recent orders */}
      <div className="rounded-xl border border-card-border bg-white shadow-card">
        <div className="border-b border-card-border px-5 py-4">
          <h2 className="text-sm font-semibold text-sakura-900">
            คำสั่งซื้อล่าสุด
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted-dark">
                <th className="px-5 py-3 font-medium">เลขที่คำสั่ง</th>
                <th className="px-5 py-3 font-medium">ลูกค้า</th>
                <th className="px-5 py-3 font-medium">สถานะ</th>
                <th className="px-5 py-3 font-medium text-right">
                  ยอดรวม (บาท)
                </th>
                <th className="px-5 py-3 font-medium">วันที่</th>
              </tr>
            </thead>
            <tbody>
              {recentOrders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
                >
                  <td className="px-5 py-3 font-medium text-sakura-900">
                    {order.orderNumber}
                  </td>
                  <td className="px-5 py-3 text-sakura-700">
                    {order.customerName}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[order.status] ??
                        "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {order.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    ฿{formatPrice(order.totalTHB)}
                  </td>
                  <td className="px-5 py-3 text-muted-dark">
                    {formatDateBangkok(order.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
