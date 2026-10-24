import { EmptyState } from "./empty-state";

export function EmptyCart() {
  return <EmptyState art="marigold" title="Your cart is empty" body="Browse fresh puja flowers, garlands and daily packs. Your cart stays saved on this device." action={{ label: "Shop flowers", href: "/shop" }} />;
}
