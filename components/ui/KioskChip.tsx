"use client";

import { ComponentProps } from "react";

export function KioskChip({
  selected = false,
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`min-h-11 min-w-11 rounded-full px-4 text-sm font-medium transition duration-200 ${
        selected
          ? "bg-white text-black"
          : "bg-white/10 text-white ring-1 ring-white/15 active:bg-white/16"
      } ${className}`}
      {...props}
    />
  );
}

export function KioskLabel({ children }: { children: string }) {
  return (
    <p className="text-center text-[11px] font-medium tracking-[0.28em] text-accent uppercase">
      {children}
    </p>
  );
}
