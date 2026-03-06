'use client'

import Image from 'next/image'
import { MOCK_AUCTIONS } from '@/lib/backoffice-mock'
import { formatPrice } from '@/lib/utils'

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  ended: 'bg-gray-100 text-gray-800',
  cancelled: 'bg-red-100 text-red-800',
}

function formatTimeLeft(endISO: string): string {
  const diff = new Date(endISO).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const hours = Math.floor(diff / 3600_000)
  const minutes = Math.floor((diff % 3600_000) / 60_000)
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h ${minutes}m`
}

export default function AuctionsPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-semibold text-sakura-900">Auctions</h1>
        <span className="text-sm text-muted-dark">{MOCK_AUCTIONS.length} auctions</span>
      </div>

      <div className="rounded-xl border border-card-border bg-white shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-card-border text-left text-xs text-muted-dark bg-sakura-50">
                <th className="px-5 py-3 font-medium">Product</th>
                <th className="px-5 py-3 font-medium text-right">Starting Price</th>
                <th className="px-5 py-3 font-medium text-right">Current Bid</th>
                <th className="px-5 py-3 font-medium text-center">Bids</th>
                <th className="px-5 py-3 font-medium">Time Left</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_AUCTIONS.map((auction) => (
                <tr
                  key={auction.id}
                  className="border-b border-card-border last:border-0 hover:bg-sakura-50 transition-colors"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sakura-100">
                        <Image
                          src={auction.imageUrl}
                          alt={auction.productName}
                          fill
                          className="object-cover"
                          sizes="40px"
                        />
                      </div>
                      <span className="font-medium text-sakura-900 line-clamp-1">
                        {auction.productName}
                      </span>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">
                    ¥{formatPrice(auction.startingPrice)}
                  </td>
                  <td className="px-5 py-3 text-right font-medium">
                    ¥{formatPrice(auction.currentBid)}
                  </td>
                  <td className="px-5 py-3 text-center">{auction.bidCount}</td>
                  <td className="px-5 py-3 text-sakura-700">
                    {formatTimeLeft(auction.endTimeISO)}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_BADGE[auction.status] ?? 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {auction.status}
                    </span>
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
