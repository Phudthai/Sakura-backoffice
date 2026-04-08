"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Users,
  Gavel,
  Receipt,
  UserCog,
  Settings,
  ChevronDown,
  ChevronRight,
  ShoppingCart,
  Package,
  Truck,
} from "lucide-react";

type NavSubItem = { href: string; label: string };

type NavEntry =
  | {
      kind: "link";
      id: string;
      href: string;
      label: string;
      icon: LucideIcon;
    }
  | {
      kind: "submenu";
      id: string;
      label: string;
      icon: LucideIcon;
      items: readonly NavSubItem[];
    };

const NAV_CONFIG: readonly NavEntry[] = [
  {
    kind: "link",
    id: "overview",
    href: "/overview",
    label: "เช็คภาพรวม",
    icon: BarChart3,
  },
  {
    kind: "link",
    id: "purchased",
    href: "/auctions/completed",
    label: "การจัดการสินค้าที่ซื้อแล้ว",
    icon: Package,
  },
  {
    kind: "link",
    id: "purchased-v2",
    href: "/auctions/completed-v2",
    label: "การจัดการสินค้าที่ซื้อแล้ว v2",
    icon: Package,
  },
  {
    kind: "submenu",
    id: "buyout",
    label: "กดเว็ป",
    icon: ShoppingCart,
    items: [
      {
        href: "/auctions/open-bid-for-user?purchase_mode=BUYOUT",
        label: "กดเว็ปครั้งแรก",
      },
    ],
  },
  {
    kind: "submenu",
    id: "auction",
    label: "ประมูล",
    icon: Gavel,
    items: [
      {
        href: "/auctions/open-bid-for-user?purchase_mode=AUCTION",
        label: "ประมูลครั้งแรก",
      },
      { href: "/auctions/pending-bids", label: "ประมูลที่รออนุมัติ" },
    ],
  },
  {
    kind: "link",
    id: "shipping-lots",
    href: "/auctions/shipping-lots",
    label: "ล็อตการจัดส่ง",
    icon: Truck,
  },
  {
    kind: "submenu",
    id: "slips",
    label: "เช็คสลิป",
    icon: Receipt,
    items: [{ href: "/slips/pending", label: "รอตรวจสอบ" }],
  },
  {
    kind: "link",
    id: "customers",
    href: "/customers",
    label: "รายชื่อลูกค้า",
    icon: Users,
  },
  {
    kind: "link",
    id: "staffs",
    href: "/staffs",
    label: "รายชื่อพนักงาน",
    icon: UserCog,
  },
  {
    kind: "link",
    id: "settings",
    href: "/settings",
    label: "ตั้งค่า",
    icon: Settings,
  },
] as const;

function isTopLinkActive(href: string, pathname: string): boolean {
  if (href === "/overview") return pathname === "/overview";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Match submenu link; supports query string on href. */
function isSubItemActive(
  itemHref: string,
  pathname: string,
  searchParams: URLSearchParams,
): boolean {
  const [pathPart, queryPart] = itemHref.split("?");
  if (pathname !== pathPart) return false;
  if (!queryPart) return true;
  const expected = new URLSearchParams(queryPart);
  const wantMode = expected.get("purchase_mode");
  if (
    pathPart === "/auctions/open-bid-for-user" &&
    wantMode === "AUCTION"
  ) {
    return searchParams.get("purchase_mode") !== "BUYOUT";
  }
  for (const [k, v] of expected.entries()) {
    if (searchParams.get(k) !== v) return false;
  }
  return true;
}

/** open-bid + no/bad purchase_mode counts as AUCTION for menu highlighting */
function isAuctionFirstActive(
  pathname: string,
  purchaseMode: string | null,
): boolean {
  if (pathname !== "/auctions/open-bid-for-user") return false;
  return purchaseMode !== "BUYOUT";
}

export default function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const purchaseModeParam = searchParams.get("purchase_mode");

  const buyoutSectionActive = useMemo(
    () =>
      pathname === "/auctions/open-bid-for-user" &&
      purchaseModeParam === "BUYOUT",
    [pathname, purchaseModeParam],
  );

  const auctionSectionActive = useMemo(
    () =>
      pathname === "/auctions/pending-bids" ||
      isAuctionFirstActive(pathname, purchaseModeParam),
    [pathname, purchaseModeParam],
  );

  const slipSectionActive = pathname.startsWith("/slips");

  const [buyoutOpen, setBuyoutOpen] = useState(buyoutSectionActive);
  const [auctionOpen, setAuctionOpen] = useState(auctionSectionActive);
  const [slipOpen, setSlipOpen] = useState(slipSectionActive);

  useEffect(() => {
    if (buyoutSectionActive) setBuyoutOpen(true);
  }, [buyoutSectionActive]);

  useEffect(() => {
    if (auctionSectionActive) setAuctionOpen(true);
  }, [auctionSectionActive]);

  useEffect(() => {
    if (slipSectionActive) setSlipOpen(true);
  }, [slipSectionActive]);

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col border-r border-card-border bg-white">
      <div className="flex h-14 items-center gap-2 border-b border-card-border px-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-header text-white text-sm font-bold">
          S
        </div>
        <span className="text-base font-semibold text-sakura-900">
          Sakura Admin
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <ul className="space-y-1">
          {NAV_CONFIG.map((entry) => {
            if (entry.kind === "link") {
              const { id, href, label, icon: Icon } = entry;
              const isActive = isTopLinkActive(href, pathname);
              return (
                <li key={id}>
                  <Link
                    href={href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                      ${
                        isActive
                          ? "bg-sakura-100 text-sakura-900"
                          : "text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900"
                      }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                  </Link>
                </li>
              );
            }

            const { id, label, icon: Icon, items } = entry;
            const isOpen =
              id === "buyout"
                ? buyoutOpen
                : id === "auction"
                  ? auctionOpen
                  : slipOpen;
            const setOpen =
              id === "buyout"
                ? setBuyoutOpen
                : id === "auction"
                  ? setAuctionOpen
                  : setSlipOpen;
            const sectionActive =
              id === "buyout"
                ? buyoutSectionActive
                : id === "auction"
                  ? auctionSectionActive
                  : slipSectionActive;

            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setOpen(!isOpen)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${
                      sectionActive
                        ? "bg-sakura-100 text-sakura-900"
                        : "text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900"
                    }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="text-left truncate">{label}</span>
                  </div>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0" />
                  )}
                </button>
                {isOpen && (
                  <ul className="mt-1 ml-4 space-y-0.5 border-l border-sakura-200 pl-3">
                    {items.map((sub) => {
                      const isSubActive = isSubItemActive(
                        sub.href,
                        pathname,
                        searchParams,
                      );
                      return (
                        <li key={sub.href}>
                          <Link
                            href={sub.href}
                            className={`block rounded-lg px-2 py-1.5 text-sm transition-colors
                              ${
                                isSubActive
                                  ? "font-medium text-sakura-900 bg-sakura-100"
                                  : "text-sakura-600 hover:bg-sakura-50 hover:text-sakura-900"
                              }`}
                          >
                            {sub.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
