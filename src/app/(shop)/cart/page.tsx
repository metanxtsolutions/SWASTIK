import type { Metadata } from "next";
import { siteData } from "@/server/site";
import { CartView } from "@/components/shop/cart-view";

export const metadata: Metadata = { title: "Your cart", robots: { index: false, follow: false } };

export default async function CartPage() {
  const site = await siteData();
  return (
    <div className="container-page py-6 pb-28 lg:pb-10">
      <h1 className="mb-5 text-3xl font-semibold">Your cart</h1>
      <CartView checkoutNote={site.settings.checkout.checkoutNote} />
    </div>
  );
}
