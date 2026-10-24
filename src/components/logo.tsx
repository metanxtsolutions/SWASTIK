import { logoMarkSvg } from "@/lib/illustrations";

const MARK = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoMarkSvg(40))}`;

/** The Swastik wordmark with its marigold mark. An uploaded logo can replace it later. */
export function Logo({ name = "Swastik", tagline, size = "md" }: { name?: string; tagline?: string; size?: "sm" | "md" }) {
  const mark = size === "sm" ? 28 : 34;
  return (
    <span className="inline-flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={MARK} width={mark} height={mark} alt="" aria-hidden="true" />
      <span className="flex flex-col leading-none">
        <span className={`font-display font-semibold text-ink ${size === "sm" ? "text-xl" : "text-[1.35rem] sm:text-2xl"}`}>{name}</span>
        {tagline ? <span className="mt-0.5 hidden text-[0.7rem] font-medium tracking-wide text-muted sm:block">{tagline}</span> : null}
      </span>
    </span>
  );
}
