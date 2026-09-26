"use client";

import { canUseGrid } from "@/lib/booth/guest-presets";
import { FrameStyle, LayoutStyle } from "@/lib/types";

function frameClass(frame: FrameStyle) {
  if (frame === "booth" || frame === "classic") return "bg-[#f4efe8] p-1";
  if (frame === "gold") return "bg-accent p-[3px]";
  if (frame === "minimal") return "bg-black p-1";
  return "bg-black p-0";
}

export function LayoutMock({
  photos,
  layout,
  frame,
  poster,
  aspectRatio,
  active,
  onClick,
  label,
}: {
  photos: number;
  layout: LayoutStyle;
  frame: FrameStyle;
  poster?: string;
  aspectRatio: number | null;
  active?: boolean;
  onClick?: () => void;
  label: string;
}) {
  const ratio = aspectRatio && aspectRatio > 0 ? aspectRatio : 4 / 5;
  const grid = layout === "grid" && canUseGrid(photos);
  const cols = grid ? (photos === 6 && ratio >= 1 ? 3 : 2) : 1;
  const count = Math.max(photos, 1);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-w-[6.5rem] shrink-0 rounded-2xl text-left transition duration-200 active:scale-[0.98] ${
        active ? "ring-2 ring-accent ring-offset-2 ring-offset-black" : "ring-1 ring-white/20"
      }`}
    >
      <div className={`overflow-hidden rounded-xl ${frameClass(frame)}`}>
        <div
          className={`grid ${frame === "none" ? "gap-[2px]" : "gap-0.5"}`}
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            background: frame === "booth" || frame === "classic" ? "#f4efe8" : "#111",
          }}
        >
          {Array.from({ length: count }, (_, key) => (
            <div
              key={key}
              className="overflow-hidden bg-black"
              style={{ aspectRatio: String(ratio) }}
            >
              {poster ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={poster} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-white/10" />
              )}
            </div>
          ))}
        </div>
      </div>
      <span className="mt-1.5 block text-center text-xs font-semibold uppercase tracking-[0.16em] text-white/80">
        {label}
      </span>
    </button>
  );
}
