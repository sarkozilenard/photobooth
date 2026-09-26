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
      "bg-white text-black shadow-[0_20px_60px_rgba(255,255,255,0.12)] active:scale-[0.98]",
    gold: "bg-[#c4a35a] text-[#14110c] active:scale-[0.98]",
    ghost:
      "bg-white/8 text-white border border-white/15 active:bg-white/12",
  }[variant];

  return (
    <button
      type={type}
      className={`min-h-16 min-w-[11rem] rounded-full px-8 text-lg font-semibold tracking-[0.18em] uppercase transition duration-200 disabled:opacity-40 ${styles} ${className}`}
      {...props}
    />
  );
}
