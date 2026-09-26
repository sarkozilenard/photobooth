"use client";

import { useEffect, useRef } from "react";
import { BoothLook, BOOTH_LOOKS } from "@/lib/effects/looks";
import { LookOverlay } from "@/components/booth/LookOverlay";

function LookTile({
  look,
  stream,
  selected,
  onSelect,
  compact = false,
  wide = false,
}: {
  look: BoothLook;
  stream: MediaStream | null;
  selected?: boolean;
  onSelect: (look: BoothLook) => void;
  compact?: boolean;
  wide?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => undefined);
  }, [stream]);

  return (
    <button
      type="button"
      onClick={() => onSelect(look)}
      className={`group relative shrink-0 overflow-hidden rounded-2xl text-left ring-2 transition duration-200 ${
        compact
          ? wide
            ? "h-[4.6rem] w-full sm:h-20"
            : "h-20 w-20 sm:h-[5.5rem] sm:w-[5.5rem]"
          : "min-h-[7.5rem] sm:min-h-[9.5rem]"
      } ${
        selected
          ? "ring-[#c4a35a] ring-offset-2 ring-offset-black scale-[1.02]"
          : "ring-white/15 active:scale-[0.98]"
      }`}
      aria-pressed={selected}
      aria-label={`${look.label}: ${look.hint}`}
    >
      <video
        ref={videoRef}
        className="h-full w-full bg-black object-contain"
        style={{ filter: look.filter }}
        playsInline
        muted
        autoPlay
      />
      <LookOverlay look={look} />
      <span
        className={`absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/80 to-transparent ${
          compact ? "px-2 pb-1.5 pt-6" : "px-3 pb-2.5 pt-8"
        }`}
      >
        <span
          className={`block font-semibold uppercase tracking-[0.16em] ${
            compact ? "text-[10px]" : "text-sm"
          }`}
        >
          {look.label}
        </span>
        {compact ? null : (
          <span className="block text-[11px] text-white/65">{look.hint}</span>
        )}
      </span>
    </button>
  );
}

export function LookGrid({
  stream,
  selectedId,
  onSelect,
  compact = false,
}: {
  stream: MediaStream | null;
  selectedId?: string;
  onSelect: (look: BoothLook) => void;
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-3 ${compact ? "gap-1.5" : "gap-2 sm:gap-3"}`}>
      {BOOTH_LOOKS.map((look) => (
        <LookTile
          key={look.id}
          look={look}
          stream={stream}
          selected={look.id === selectedId}
          onSelect={onSelect}
          compact={compact}
          wide={compact}
        />
      ))}
    </div>
  );
}

export function LookStrip({
  stream,
  selectedId,
  onSelect,
}: {
  stream: MediaStream | null;
  selectedId: string;
  onSelect: (look: BoothLook) => void;
}) {
  return (
    <div className="flex max-w-full gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {BOOTH_LOOKS.map((look) => (
        <LookTile
          key={look.id}
          look={look}
          stream={stream}
          selected={look.id === selectedId}
          onSelect={onSelect}
          compact
        />
      ))}
    </div>
  );
}
