import Link from "next/link";
import { EmptyState } from "@/components/shop/empty-state";

export default function NotFound() {
  return (
    <div className="container-page py-12">
      <EmptyState
        art="lotus"
        title="We could not find that page"
        body={
          <>
            <p>The page may have moved, or the link may be incomplete.</p>
            <p className="mt-3 flex flex-wrap justify-center gap-3 text-sm">
              <Link href="/" className="font-semibold text-saffron-dark underline">
                Home
              </Link>
              <Link href="/track" className="font-semibold text-saffron-dark underline">
                Track an order
              </Link>
              <Link href="/contact" className="font-semibold text-saffron-dark underline">
                Contact us
              </Link>
            </p>
          </>
        }
        action={{ label: "Shop flowers", href: "/shop" }}
      />
    </div>
  );
}
