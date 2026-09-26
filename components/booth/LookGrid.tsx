"use client";

import { useEffect, useRef } from "react";
import { BoothLook, BOOTH_LOOKS } from "@/lib/effects/looks";
import { LookOverlay } from "@/components/booth/LookOverlay";

function LookTile({
  look,
  stream,
  poster,
  selected,
  tiny = false,
  onSelect,
}: {
  look: BoothLook;
  stream: MediaStream | null;
  poster?: string;
  selected?: boolean;
  tiny?: boolean;
  onSelect: (look: BoothLook) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (poster) return;
    const video = videoRef.current;
    if (!video || !stream) return;
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    void video.play().catch(() => undefined);
  }, [stream, poster]);

  return (
    <button
      type="button"
      onClick={() => onSelect(look)}
      className={`group relative shrink-0 overflow-hidden rounded-xl text-left ring-2 transition duration-200 ${
        tiny ? "h-12 w-12" : "h-16 w-16 sm:h-[4.25rem] sm:w-[4.25rem]"
      } ${
        selected
          ? "ring-[#c4a35a] ring-offset-2 ring-offset-black"
          : "ring-white/15 active:scale-[0.98]"
      }`}
      aria-pressed={selected}
      aria-label={`${look.label}: ${look.hint}`}
    >
      {poster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={poster}
          alt=""
          className="h-full w-full bg-black object-cover"
          style={{ filter: look.filter }}
        />
      ) : (
        <video
          ref={videoRef}
          className="h-full w-full bg-black object-cover"
          style={{ filter: look.filter }}
          playsInline
          muted
          autoPlay
        />
      )}
      <LookOverlay look={look} />
      <span className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/85 to-transparent px-1 pb-1 pt-5">
        <span className="block text-[9px] font-semibold uppercase tracking-[0.12em]">
          {look.label}
        </span>
      </span>
    </button>
  );
}

export function LookGrid({
  stream,
  selectedId,
  onSelect,
  compact = false,
  poster,
}: {
  stream: MediaStream | null;
  selectedId?: string;
  onSelect: (look: BoothLook) => void;
  compact?: boolean;
  poster?: string;
}) {
  return (
    <div className={`grid grid-cols-3 ${compact ? "gap-1.5" : "gap-2 sm:gap-3"}`}>
      {BOOTH_LOOKS.map((look) => (
        <LookTile
          key={look.id}
          look={look}
          stream={stream}
          poster={poster}
          selected={look.id === selectedId}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

export function LookStrip({
  stream,
  selectedId,
  onSelect,
  poster,
  tiny = false,
}: {
  stream: MediaStream | null;
  selectedId: string;
  onSelect: (look: BoothLook) => void;
  poster?: string;
  tiny?: boolean;
}) {
  return (
    <div className="flex max-w-full gap-1.5 overflow-x-auto px-1 pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {BOOTH_LOOKS.map((look) => (
        <LookTile
          key={look.id}
          look={look}
          stream={stream}
          poster={poster}
          selected={look.id === selectedId}
          tiny={tiny}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}
