import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRightLeft, BookOpen, FileText, HelpCircle, Home, Image as ImageIcon, MessageSquareQuote } from "lucide-react";
import { PageHeader } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Website content" };

const ITEMS = [
  { href: "/admin/content/homepage", icon: Home, title: "Home page", body: "Announcement bar, hero text, which sections show, featured categories and products." },
  { href: "/admin/content/banners", icon: ImageIcon, title: "Banners and offers", body: "Hero banners with photos and offer cards, with optional start and end dates." },
  { href: "/admin/content/faqs", icon: HelpCircle, title: "Questions and answers", body: "FAQs for the FAQ page, home page, delivery and bulk pages, and categories." },
  { href: "/admin/content/pages", icon: FileText, title: "Pages and policies", body: "About us, privacy, terms, cancellation and delivery policies." },
  { href: "/admin/content/guides", icon: BookOpen, title: "Guides", body: "Articles about puja flowers that help customers and search engines." },
  { href: "/admin/content/reviews", icon: MessageSquareQuote, title: "Customer reviews", body: "Genuine reviews from customers, shown only when you publish them." },
  { href: "/admin/content/redirects", icon: ArrowRightLeft, title: "Redirects", body: "Send old links to new pages so visitors and search engines find them." },
];

export default function ContentHub() {
  return (
    <>
      <PageHeader title="Website content" description="Everything customers read on the website. Changes appear on the site within a few minutes." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ITEMS.map((i) => (
          <li key={i.href}>
            <Link href={i.href} className="card block h-full p-5 hover:border-saffron">
              <i.icon aria-hidden className="h-5 w-5 text-saffron" />
              <h2 className="mt-2 font-sans text-base font-semibold">{i.title}</h2>
              <p className="mt-1 text-sm text-ink-soft">{i.body}</p>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-sm text-muted">
        Business details, contact numbers and SEO defaults are under <Link href="/admin/settings" className="font-semibold text-saffron-dark underline">Settings</Link>.
      </p>
    </>
  );
}
