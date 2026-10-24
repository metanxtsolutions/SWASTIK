import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function Section({ id, title, intro, href, hrefLabel = "View all", children, className = "" }: { id?: string; title: string; intro?: string; href?: string; hrefLabel?: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id ? `${id}-title` : undefined} className={`container-page py-8 sm:py-10 ${className}`}>
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <h2 id={id ? `${id}-title` : undefined} className="section-title">
            {title}
          </h2>
          {intro ? <p className="mt-1.5 max-w-2xl text-ink-soft">{intro}</p> : null}
        </div>
        {href ? (
          <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-saffron-dark hover:underline sm:inline-flex">
            {hrefLabel}
            <ArrowRight aria-hidden className="h-4 w-4" />
          </Link>
        ) : null}
      </div>
      {children}
      {href ? (
        <Link href={href} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-saffron-dark hover:underline sm:hidden">
          {hrefLabel}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      ) : null}
    </section>
  );
}
