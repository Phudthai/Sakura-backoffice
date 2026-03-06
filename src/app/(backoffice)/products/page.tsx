'use client'

import Image from 'next/image'
import { MOCK_PRODUCTS } from '@/lib/backoffice-mock'
import { formatPrice } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  sold: 'bg-gray-100 text-gray-800',
  draft: 'bg-yellow-100 text-yellow-800',
}

export default function ProductsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">Products</h1>
        <span className="text-sm text-muted-dark">{MOCK_PRODUCTS.length} products</span>
      </div>

      <div className="rounded-xl border border-card-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted-dark bg-sakura-50">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium text-right">Price (JPY)</th>
                <th className="px-5 py-3 font-medium">Condition</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Created</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PRODUCTS.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sakura-100">
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <span className="font-medium text-sakura-900 line-clamp-1">
                        {product.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    ¥{formatPrice(product.price)}
                  </td>
                  <td className="px-5 py-3 text-sakura-700">{product.condition}</td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        product.isAuction
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {product.isAuction ? 'Auction' : 'Fixed Price'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[product.status] ?? 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {product.status}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-muted-dark">
                    {new Date(product.createdAt).toLocaleDateString('th-TH', {
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
