import Link from "next/link";

export function Pagination({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (p: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pages" className="mt-8 flex items-center justify-center gap-2">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className="btn btn-secondary btn-sm" rel="prev">
          Previous
        </Link>
      ) : null}
      <span className="px-2 text-sm text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className="btn btn-secondary btn-sm" rel="next">
          Next
        </Link>
      ) : null}
    </nav>
  );
}
