"use client";

import { useEffect } from "react";
import { RefreshCw } from "lucide-react";

export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <div className="container-page py-12">
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-ink-soft">This page could not be loaded. Please check your connection and try again. Your cart is saved on this device.</p>
        <button type="button" onClick={reset} className="btn btn-primary mt-5">
          <RefreshCw aria-hidden className="h-4 w-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
