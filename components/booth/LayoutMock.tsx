"use client";

import { canUseGrid } from "@/lib/booth/guest-presets";
import { FrameStyle, LayoutStyle } from "@/lib/types";

export function LayoutMock({
  photos,
  layout,
  frame,
  aspectRatio,
  active,
  onClick,
  label,
}: {
  photos: number;
  layout: LayoutStyle;
  frame: FrameStyle;
  aspectRatio: number | null;
  active?: boolean;
  onClick?: () => void;
  label: string;
}) {
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 4 / 5;
  const grid = layout === "grid" && canUseGrid(photos);
  const cols = grid ? (photos === 6 && ratio >= 1 ? 3 : 2) : 1;
  const count = Math.max(photos, 1);
  const blue = frame !== "minimal";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-[6.5rem] shrink-0 rounded-2xl text-left transition duration-200 active:scale-[0.98] ${
        active ? "ring-2 ring-accent ring-offset-2 ring-offset-black" : "ring-1 ring-white/20"
      }`}
    >
      <div className={`overflow-hidden rounded-xl p-2 ${blue ? "bg-white" : "bg-zinc-900"}`}>
        <div className={`p-[3px] ${blue ? "bg-accent" : "bg-white/20"}`}>
          <div
            className="grid gap-[2px] bg-white"
            style={{
              gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            }}
          >
            {Array.from({ length: count }, (_, key) => (
              <div
                key={key}
                className="bg-zinc-200"
                style={{ aspectRatio: String(ratio) }}
              />
            ))}
          </div>
        </div>
      </div>
      <span className="mt-1.5 block text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
        {label}
      </span>
    </button>
  );
}
