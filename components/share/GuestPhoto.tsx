"use client";

import { useEffect, useState } from "react";

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function canShareFile(file: File) {
  try {
    return (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    );
  } catch {
    return false;
  }
}

export function GuestPhoto({
  src,
  filename,
}: {
  src: string;
  filename: string;
}) {
  const [status, setStatus] = useState("A fotó mentése…");

  useEffect(() => {
    if (isIOS()) {
      setStatus("Koppints a képre → Mentés a Fotókba.");
      return;
    }
    let cancelled = false;

    async function save() {
      try {
        const res = await fetch(src);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 2500);
        if (!cancelled) setStatus("Elmentve a letöltésekbe.");
      } catch {
        if (!cancelled) setStatus("A fotó itt van. Tartsd lenyomva a mentéshez.");
      }
    }

    void save();
    return () => {
      cancelled = true;
    };
  }, [src, filename]);

  async function sharePhoto() {
    try {
      const res = await fetch(src);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type || "image/jpeg" });
      if (canShareFile(file) && typeof navigator.share === "function") {
        await navigator.share({
          files: [file],
          title: "PHOTO BOOTH",
        });
        setStatus("Kész.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2500);
      setStatus("Letöltve.");
    } catch {
      /* user cancelled share */
    }
  }

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-black p-6 text-white">
      <button type="button" className="max-w-3xl" onClick={() => void sharePhoto()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="PHOTO BOOTH fotó"
          className="max-h-[78dvh] w-full object-contain"
        />
      </button>
      <p className="max-w-sm text-center text-sm text-white/70">{status}</p>
    </div>
  );
}
