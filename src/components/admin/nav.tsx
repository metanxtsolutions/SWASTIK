"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Boxes, Building2, ClipboardList, ExternalLink, FileText, FolderTree, Gauge, History, Inbox, Layers, Menu, Settings, ShoppingBag, Tag, Truck, UserCog, X } from "lucide-react";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/admin", label: "Overview", icon: Gauge, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, badge: "orders" },
  { href: "/admin/bulk-enquiries", label: "Bulk enquiries", icon: Building2, badge: "enquiries" },
  { href: "/admin/products", label: "Products", icon: ShoppingBag },
  { href: "/admin/inventory", label: "Stock", icon: Boxes },
  { href: "/admin/categories", label: "Categories", icon: FolderTree },
  { href: "/admin/collections", label: "Collections", icon: Layers },
  { href: "/admin/delivery", label: "Delivery areas", icon: Truck },
  { href: "/admin/coupons", label: "Promo codes", icon: Tag },
  { href: "/admin/content", label: "Website content", icon: FileText },
  { href: "/admin/messages", label: "Messages", icon: Inbox, badge: "messages" },
  { href: "/admin/settings", label: "Settings", icon: Settings },
  { href: "/admin/account", label: "Account", icon: UserCog },
  { href: "/admin/activity", label: "Activity log", icon: History },
] as const;

export function AdminNav({ badges, logout }: { badges: Record<string, number>; logout: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = (
    <ul className="space-y-0.5">
      {NAV.map((n) => {
        const active = "exact" in n && n.exact ? pathname === n.href : pathname.startsWith(n.href);
        const count = "badge" in n ? badges[n.badge] : 0;
        return (
          <li key={n.href}>
            <Link href={n.href} onClick={() => setOpen(false)} aria-current={active ? "page" : undefined} className={cn("flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium", active ? "bg-saffron-soft text-saffron-dark" : "text-ink-soft hover:bg-sand")}>
              <n.icon aria-hidden className="h-4.5 w-4.5" />
              <span className="flex-1">{n.label}</span>
              {count ? <span className="rounded-full bg-saffron px-2 py-0.5 text-xs font-bold text-white">{count}</span> : null}
            </Link>
          </li>
        );
      })}
      <li className="pt-2">
        <Link href="/" target="_blank" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm text-ink-soft hover:bg-sand">
          <ExternalLink aria-hidden className="h-4.5 w-4.5" />
          View website
        </Link>
      </li>
    </ul>
  );
  return (
    <>
      <div className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-paper px-4 lg:hidden">
        <Link href="/admin" className="font-display text-lg font-semibold">
          Swastik admin
        </Link>
        <button type="button" onClick={() => setOpen(true)} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Open menu" aria-expanded={open}>
          <Menu aria-hidden className="h-5 w-5" />
        </button>
      </div>
      {open ? (
        <div className="fixed inset-0 z-40 bg-ink/40 lg:hidden" onClick={() => setOpen(false)}>
          <nav aria-label="Admin" className="h-full w-72 overflow-y-auto bg-paper p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <span className="font-display text-lg font-semibold">Menu</span>
              <button type="button" onClick={() => setOpen(false)} className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Close menu">
                <X aria-hidden className="h-5 w-5" />
              </button>
            </div>
            {links}
            <div className="mt-4 border-t border-line pt-4">{logout}</div>
          </nav>
        </div>
      ) : null}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col overflow-y-auto border-r border-line bg-paper p-4 lg:flex">
        <Link href="/admin" className="mb-5 px-3 font-display text-xl font-semibold">
          Swastik admin
        </Link>
        <nav aria-label="Admin" className="flex-1">
          {links}
        </nav>
        <div className="border-t border-line pt-4">{logout}</div>
      </aside>
    </>
  );
}
