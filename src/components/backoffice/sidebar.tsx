'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Gavel,
  Receipt,
  UserCog,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'

const AUCTION_SUB_ITEMS = [
  { href: '/auctions/open-bid-for-user', label: 'เปิดประมูลสินค้าให้ลูกค้า' },
  { href: '/auctions/pending-bids', label: 'การประมูลที่รออนุมัติ' },
  { href: '/auctions/completed', label: 'การประมูลที่สิ้นสุดแล้ว' },
  { href: '/auctions/shipping-lots', label: 'ล็อตการจัดส่ง' },
] as const

const SLIP_SUB_ITEMS = [
  { href: '/slips/pending', label: 'รอตรวจสอบ' },
] as const

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/auctions', label: 'ประมูล', icon: Gavel, hasSubmenu: true },
  { href: '/slips', label: 'เช็คสลิป', icon: Receipt, hasSubmenu: true },
  { href: '/staffs', label: 'Staffs', icon: UserCog },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export default function Sidebar() {
  const pathname = usePathname()
  const isAuctionActive = pathname.startsWith('/auctions')
  const isSlipActive = pathname.startsWith('/slips')
  const [auctionOpen, setAuctionOpen] = useState(isAuctionActive)
  const [slipOpen, setSlipOpen] = useState(isSlipActive)

  useEffect(() => {
    if (isAuctionActive) setAuctionOpen(true)
  }, [isAuctionActive])
  useEffect(() => {
    if (isSlipActive) setSlipOpen(true)
  }, [isSlipActive])

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-card-border bg-white">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-card-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-header text-white text-sm font-bold">
          S
        </div>
        <span className="text-base font-semibold text-sakura-900">
          Sakura Admin
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const { href, label, icon: Icon } = item
            const hasSubmenu = 'hasSubmenu' in item && item.hasSubmenu
            if (hasSubmenu && href === '/auctions') {
              const isOpen = auctionOpen
              return (
                <li key={href}>
                  <button
                    type="button"
                    onClick={() => setAuctionOpen(!isOpen)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                      ${
                        isAuctionActive
                          ? 'bg-sakura-100 text-sakura-900'
                          : 'text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <ul className="mt-1 ml-4 space-y-0.5 border-l border-sakura-200 pl-3">
                      {AUCTION_SUB_ITEMS.map(({ href: subHref, label: subLabel }) => {
                        const isSubActive = pathname === subHref
                        return (
                          <li key={subHref}>
                            <Link
                              href={subHref}
                              className={`block rounded-lg px-2 py-1.5 text-sm transition-colors
                                ${
                                  isSubActive
                                    ? 'font-medium text-sakura-900 bg-sakura-100'
                                    : 'text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900'
                                }`}
                            >
                              {subLabel}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            }

            if (hasSubmenu && href === '/slips') {
              const isOpen = slipOpen
              return (
                <li key={href}>
                  <button
                    type="button"
                    onClick={() => setSlipOpen(!isOpen)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                      ${
                        isSlipActive
                          ? 'bg-sakura-100 text-sakura-900'
                          : 'text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </div>
                    {isOpen ? (
                      <ChevronDown className="h-4 w-4 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0" />
                    )}
                  </button>
                  {isOpen && (
                    <ul className="mt-1 ml-4 space-y-0.5 border-l border-sakura-200 pl-3">
                      {SLIP_SUB_ITEMS.map(({ href: subHref, label: subLabel }) => {
                        const isSubActive = pathname === subHref
                        return (
                          <li key={subHref}>
                            <Link
                              href={subHref}
                              className={`block rounded-lg px-2 py-1.5 text-sm transition-colors
                                ${
                                  isSubActive
                                    ? 'font-medium text-sakura-900 bg-sakura-100'
                                    : 'text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900'
                                }`}
                            >
                              {subLabel}
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </li>
              )
            }

            const isActive =
              href === '/' ? pathname === '/' : pathname.startsWith(href)

            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${
                      isActive
                        ? 'bg-sakura-100 text-sakura-900'
                        : 'text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900'
                    }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>
    </aside>
  )
}
