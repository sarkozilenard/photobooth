"use client";

import { useEffect, useState } from "react";
import { GuestPhoto } from "@/components/share/GuestPhoto";
import { pullShareFromBooth } from "@/lib/webrtc/live";

export function PullShare({ code }: { code: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("Az iPad booth keresése…");

  useEffect(() => {
    let url = "";
    let cancelled = false;
    void pullShareFromBooth(code, setStatus)
      .then((blob) => {
        if (cancelled) return;
        const jpeg = new File([blob], `photobooth-${code}.jpg`, { type: "image/jpeg" });
        url = URL.createObjectURL(jpeg);
        setFile(jpeg);
        setSrc(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "A fotó nem jött át.");
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [code]);

  if (error) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white">
        <p className="font-serif text-4xl">A fotó nem jött át</p>
        <p className="max-w-sm text-white/70">{error}</p>
      </div>
    );
  }

  if (!src || !file) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-4 bg-black p-8 text-center text-white">
        <p className="text-[11px] tracking-[0.4em] text-accent">PHOTO BOOTH</p>
        <p className="text-white/75">{status}</p>
      </div>
    );
  }

  return <GuestPhoto src={src} file={file} filename={`photobooth-${code}.jpg`} />;
}
