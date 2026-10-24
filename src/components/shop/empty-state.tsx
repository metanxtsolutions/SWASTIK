import Link from "next/link";
import { illustrationDataUri, type IllustrationKind } from "@/lib/illustrations";

export function EmptyState({ title, body, action, art = "generic" }: { title: string; body?: React.ReactNode; action?: { label: string; href: string }; art?: IllustrationKind }) {
  return (
    <div className="card mx-auto flex max-w-xl flex-col items-center p-8 text-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={illustrationDataUri(art)} alt="" aria-hidden className="h-28 w-28 rounded-full" />
      <h2 className="mt-4 text-2xl font-semibold">{title}</h2>
      {body ? <div className="mt-2 text-ink-soft">{body}</div> : null}
      {action ? (
        <Link href={action.href} className="btn btn-primary mt-5">
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
