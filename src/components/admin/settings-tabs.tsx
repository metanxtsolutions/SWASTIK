import Link from "next/link";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/admin/settings", label: "Business" },
  { href: "/admin/settings/checkout", label: "Checkout and payments" },
  { href: "/admin/settings/notifications", label: "Notifications" },
  { href: "/admin/settings/seo", label: "Search engines" },
];

export function SettingsTabs({ active }: { active: string }) {
  return (
    <nav aria-label="Settings" className="no-scrollbar mb-6 flex gap-1 overflow-x-auto border-b border-line">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} aria-current={t.href === active ? "page" : undefined} className={cn("whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-semibold", t.href === active ? "border-saffron text-saffron-dark" : "border-transparent text-muted hover:text-ink")}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
