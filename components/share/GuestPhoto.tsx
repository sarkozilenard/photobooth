"use client";

import { useEffect, useState } from "react";
import { saveToDevice } from "@/lib/photos/queue";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

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
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl = "";

    async function load() {
      try {
        if (incoming) {
          const jpeg =
            incoming instanceof File
              ? incoming
              : new File([incoming], filename, { type: "image/jpeg" });
          objectUrl = URL.createObjectURL(jpeg);
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setFile(jpeg);
          setLocalUrl(objectUrl);
          saveToDevice(jpeg, filename);
          setStatus(
            isIOS()
              ? "Mentve erre a telefonra. Fotókba: tartsd lenyomva a képet → Mentés a Fotókba."
              : "A fotó letöltődött erre a telefonra.",
          );
          return;
        }
        if (!src) throw new Error("Nincs fotó");
        const res = await fetch(src, { cache: "no-store" });
        if (!res.ok) throw new Error("A fotó nem tölthető le");
        const blob = await res.blob();
        if (!blob.size) throw new Error("Üres fájl");
        const jpeg = new File([blob], filename, { type: "image/jpeg" });
        objectUrl = URL.createObjectURL(jpeg);
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          return;
        }
        setFile(jpeg);
        setLocalUrl(objectUrl);
        saveToDevice(jpeg, filename);
        setStatus(
          isIOS()
            ? "Mentve erre a telefonra. Fotókba: tartsd lenyomva a képet → Mentés a Fotókba."
            : "A fotó letöltődött erre a telefonra.",
        );
      } catch {
        if (!cancelled) setStatus("A fotó nem tölthető le. Frissítsd az oldalt.");
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src, incoming, filename]);

  function saveAgain() {
    if (!file) return;
    saveToDevice(file, filename);
    setStatus("Újra mentve erre a készülékre.");
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 bg-black px-6 py-10 text-white">
      <p className="text-[11px] font-medium tracking-[0.4em] text-accent">PHOTO BOOTH</p>
      {localUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={localUrl}
          alt="PHOTO BOOTH fotó"
          className="max-h-[62dvh] w-full max-w-3xl rounded-sm object-contain"
        />
      ) : (
        <div className="h-64 w-64 animate-pulse rounded-3xl bg-white/10" />
      )}
      <p className="max-w-sm text-center text-base leading-relaxed text-white/75">{status}</p>
      <button
        type="button"
        disabled={!file}
        onClick={saveAgain}
        className="min-h-14 w-full max-w-sm rounded-full bg-white text-lg font-semibold tracking-[0.16em] text-black uppercase disabled:opacity-40"
      >
        Mentés ide
      </button>
      <p className="max-w-sm text-center text-sm leading-relaxed text-white/45">
        Nincs megosztó. A fotó csak erre a telefonra mentődik.
      </p>
    </div>
  );
}
