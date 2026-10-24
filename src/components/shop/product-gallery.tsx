"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { ProductImage } from "./product-image";

export function ProductGallery({ images, name }: { images: { id: string; alt: string; filename: string }[]; name: string }) {
  const [active, setActive] = useState(0);
  const current = images[active] ?? null;
  return (
    <div>
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-sand">
        <ProductImage image={current} name={name} sizes="(min-width: 1024px) 560px, 100vw" priority />
      </div>
      {images.length > 1 ? (
        <ul className="no-scrollbar mt-3 flex gap-2 overflow-x-auto" aria-label="Product photos">
          {images.map((img, i) => (
            <li key={img.id} className="shrink-0">
              <button type="button" onClick={() => setActive(i)} aria-label={`Show photo ${i + 1}`} aria-pressed={i === active} className={cn("relative block h-16 w-16 overflow-hidden rounded-xl border-2 sm:h-20 sm:w-20", i === active ? "border-saffron" : "border-transparent")}>
                <Image src={`/api/media/${img.id}/${img.filename}`} alt="" fill sizes="80px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
