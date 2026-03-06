'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ShoppingCart,
  Users,
  Package,
  Gavel,
  Settings,
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/orders', label: 'Orders', icon: ShoppingCart },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/products', label: 'Products', icon: Package },
  { href: '/auctions', label: 'Auctions', icon: Gavel },
  { href: '/settings', label: 'Settings', icon: Settings },
] as const

export default function Sidebar() {
  const pathname = usePathname()

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
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
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
