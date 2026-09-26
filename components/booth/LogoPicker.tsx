"use client";

import { useEffect, useState } from "react";
import { PackagedLogo } from "@/lib/branding/packaged-logos";

export function LogoPicker({
  previewUrl,
  selectedUrl,
  onUpload,
  onPickPublic,
  onClear,
}: {
  previewUrl: string | null;
  selectedUrl?: string | null;
  onUpload: (file: File) => void;
  onPickPublic: (logo: PackagedLogo) => void;
  onClear?: () => void;
}) {
  const [packaged, setPackaged] = useState<PackagedLogo[]>([]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/branding/packaged-logos")
      .then((res) => res.json())
      .then((data: { logos?: PackagedLogo[] }) => {
        if (!cancelled) setPackaged(data.logos ?? []);
      })
      .catch(() => {
        if (!cancelled) setPackaged([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex flex-col gap-3 text-sm">
      {previewUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={previewUrl}
          alt="Aktív logó"
          className="h-20 w-auto max-w-[14rem] rounded-xl bg-white/5 object-contain p-2"
        />
      ) : (
        <p className="text-white/45">Még nincs logó.</p>
      )}

      <p className="text-xs tracking-[0.18em] text-white/40 uppercase">iPadról / telefonról</p>
      <label className="flex min-h-14 cursor-pointer items-center justify-center rounded-full bg-white px-5 text-sm font-semibold tracking-[0.12em] text-black uppercase">
        Feltöltés a galériából
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml,.svg"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </label>

      <p className="mt-1 text-xs tracking-[0.18em] text-white/40 uppercase">Public mappa</p>
      {packaged.length === 0 ? (
        <p className="text-xs leading-relaxed text-white/45">
          Tedd a PNG/JPG/SVG fájlt a projekt <span className="text-white/70">public/logos</span>{" "}
          mappájába, majd frissítsd az oldalt.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {packaged.map((item) => {
            const active = selectedUrl === item.url;
            return (
              <button
                key={item.url}
                type="button"
                onClick={() => onPickPublic(item)}
                className={`flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-2xl bg-white/5 p-2 ring-1 ${
                  active ? "ring-accent" : "ring-white/10"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="" className="h-10 w-full object-contain" />
                <span className="line-clamp-2 text-center text-[10px] leading-tight text-white/65">
                  {item.name}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {previewUrl && onClear ? (
        <button type="button" className="w-fit text-sm text-white/50 underline" onClick={onClear}>
          Logó törlése
        </button>
      ) : null}
    </div>
  );
}
