"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";

export function QuantityStepper({ value, min = 1, max, onChange, label, size = "md", disabled }: { value: number; min?: number; max?: number | null; onChange: (n: number) => void; label: string; size?: "sm" | "md"; disabled?: boolean }) {
  const h = size === "sm" ? "h-9 w-9" : "h-11 w-11";
  const upper = max ?? 1000;
  return (
    <div role="group" aria-label={label} className={cn("inline-flex items-center rounded-full border border-line bg-paper", disabled && "opacity-60")}>
      <button type="button" className={cn(h, "inline-flex items-center justify-center rounded-full text-ink hover:bg-sand disabled:opacity-40")} onClick={() => onChange(Math.max(value - 1, 0))} disabled={disabled || value <= 0} aria-label={value <= min ? "Remove" : "Decrease quantity"}>
        <Minus aria-hidden className="h-4 w-4" />
      </button>
      <input
        type="number"
        inputMode="numeric"
        className={cn("w-12 border-0 bg-transparent text-center font-semibold text-ink [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none", size === "sm" ? "text-sm" : "")}
        value={value}
        min={min}
        max={upper}
        disabled={disabled}
        aria-label="Quantity"
        onChange={(e) => {
          const n = Number(e.target.value);
          if (Number.isFinite(n)) onChange(Math.max(0, Math.min(Math.floor(n), upper)));
        }}
      />
      <button type="button" className={cn(h, "inline-flex items-center justify-center rounded-full text-ink hover:bg-sand disabled:opacity-40")} onClick={() => onChange(Math.min(Math.max(value + 1, min), upper))} disabled={disabled || value >= upper} aria-label="Increase quantity">
        <Plus aria-hidden className="h-4 w-4" />
      </button>
    </div>
  );
}
