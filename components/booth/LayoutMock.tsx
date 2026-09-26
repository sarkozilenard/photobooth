"use client";

import { FrameStyle, LayoutStyle } from "@/lib/types";

function frameClass(frame: FrameStyle) {
  if (frame === "booth" || frame === "classic") return "bg-[#f4efe8] p-1";
  if (frame === "gold") return "bg-[#c4a35a] p-[3px]";
  if (frame === "minimal") return "bg-black p-1";
  return "bg-black p-0";
}

function cells(photos: number, layout: LayoutStyle) {
  if (layout !== "grid" || photos <= 1) {
    return Array.from({ length: photos }, (_, i) => ({ key: i, className: "col-span-2" }));
  }
  if (photos === 3) {
    return [
      { key: 0, className: "" },
      { key: 1, className: "" },
      { key: 2, className: "col-start-1 justify-self-center w-1/2" },
    ];
  }
  return Array.from({ length: photos }, (_, i) => ({ key: i, className: "" }));
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
  const items = cells(Math.max(photos, 1), layout);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`w-[5.6rem] shrink-0 rounded-xl text-left ${
        active ? "ring-2 ring-[#c4a35a] ring-offset-2 ring-offset-black" : "ring-1 ring-white/20"
      }`}
    >
      <div className={`overflow-hidden rounded-xl ${frameClass(frame)}`}>
        <div
          className={`grid grid-cols-2 ${frame === "none" ? "gap-[2px]" : "gap-0.5"}`}
          style={{ background: frame === "booth" || frame === "classic" ? "#f4efe8" : "#111" }}
        >
          {items.map((item) => (
            <div
              key={item.key}
              className={`overflow-hidden bg-black ${item.className}`}
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
      <span className="mt-1 block text-center text-[10px] font-semibold uppercase tracking-[0.14em] text-white/80">
        {label}
      </span>
    </button>
  );
}
