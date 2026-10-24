import Image from "next/image";
import { illustrationFor, illustrationUrl } from "@/lib/illustrations";
import { cn } from "@/lib/cn";

interface Props {
  image: { id: string; alt: string; filename: string } | null;
  name: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** When the name is already shown next to the image (tiles), the image is decorative. */
  decorative?: boolean;
}

/**
 * A square product or category image. When no photo has been uploaded, an
 * illustration is shown and labelled as such, so it is never mistaken for a photo.
 */
export function ProductImage({ image, name, sizes, priority, className, decorative }: Props) {
  if (image) {
    return (
      <Image
        src={`/api/media/${image.id}/${image.filename}`}
        alt={decorative ? "" : image.alt || name}
        fill
        sizes={sizes}
        priority={priority}
        className={cn("object-cover", className)}
      />
    );
  }
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-sand">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={illustrationUrl(illustrationFor(name))} width={400} height={400} alt={decorative ? "" : `Illustration for ${name} (photo coming soon)`} className={cn("h-full w-full object-cover", className)} loading={priority ? "eager" : "lazy"} />
    </span>
  );
}
