"use client";

import { ComponentProps } from "react";

export function KioskButton({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: "primary" | "ghost" | "gold" }) {
  const styles = {
    primary:
      "bg-white text-black shadow-[0_16px_40px_rgba(255,255,255,0.12)] active:scale-[0.98]",
    gold: "bg-accent text-white shadow-[0_16px_40px_rgba(26,76,150,0.28)] active:scale-[0.98]",
    ghost:
      "bg-white/8 text-white ring-1 ring-white/18 active:bg-white/12",
  }[variant];

  return (
    <button
      type={type}
      className={`inline-flex min-h-14 min-w-[10rem] items-center justify-center rounded-full px-8 text-base font-semibold tracking-[0.16em] uppercase transition duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-black disabled:pointer-events-none disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}
