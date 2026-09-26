"use client";

import { useEffect, useRef } from "react";
import { BoothLook, BOOTH_LOOKS } from "@/lib/effects/looks";
import { LookOverlay } from "@/components/booth/LookOverlay";

function LookTile({
  look,
  stream,
  poster,
  selected,
  onSelect,
}: {
  look: BoothLook;
  stream: MediaStream | null;
  poster?: string;
  selected?: boolean;
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
      className={`relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl text-left ring-2 transition duration-200 active:scale-[0.97] sm:h-[5.25rem] sm:w-[5.25rem] ${
        selected
          ? "ring-accent ring-offset-2 ring-offset-black"
          : "ring-white/15"
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
      <span className="absolute inset-x-0 bottom-0 z-[2] bg-gradient-to-t from-black/90 to-transparent px-1 pb-1.5 pt-6">
        <span className="block text-center text-[11px] font-semibold tracking-[0.08em] uppercase">
          {look.label}
        </span>
      </span>
    </button>
  );
}

export function LookStrip({
  stream,
  selectedId,
  onSelect,
  poster,
  wrap = false,
}: {
  stream: MediaStream | null;
  selectedId: string;
  onSelect: (look: BoothLook) => void;
  poster?: string;
  wrap?: boolean;
}) {
  return (
    <div
      className={
        wrap
          ? "grid w-full grid-cols-3 justify-items-center gap-2.5"
          : "flex max-w-full justify-center gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      }
    >
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
