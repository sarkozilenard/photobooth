"use client";

import { useEffect, useState } from "react";

export function GuestPhoto({
  src,
  file: incoming,
  filename,
}: {
  src?: string;
  file?: File | Blob | null;
  filename: string;
}) {
  const [status, setStatus] = useState("A fotó betöltése…");
  const [localUrl, setLocalUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function load() {
      try {
        if (incoming) {
          objectUrl = URL.createObjectURL(incoming);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setLocalUrl(objectUrl);
          setStatus("A fotó a boothról jött. Tartsd lenyomva, ha a Fotókba akarod.");
          return;
        }
        if (!src) throw new Error("Nincs fotó");
        if (cancelled) return;
        setLocalUrl(src);
        setStatus("A fotó a felhőben van. Tartsd lenyomva a képet, ha elmented a Fotókba.");
      } catch {
        if (!cancelled) setStatus("A fotó nem elérhető. Frissítsd az oldalt.");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, incoming, filename]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-black px-6 py-10 text-white">
      <p className="text-[11px] font-medium tracking-[0.4em] text-accent">PHOTO BOOTH</p>
      {localUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={localUrl}
          alt="PHOTO BOOTH fotó"
          className="max-h-[72dvh] w-full max-w-3xl rounded-sm object-contain"
        />
      ) : (
        <div className="h-64 w-64 animate-pulse rounded-3xl bg-white/10" />
      )}
      <p className="max-w-sm text-center text-base leading-relaxed text-white/75">{status}</p>
    </div>
  );
}
