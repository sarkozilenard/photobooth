"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { KioskButton } from "@/components/ui/KioskButton";
import { PhotoRecord } from "@/lib/types";

async function makeQr(record: PhotoRecord) {
  const url = `${window.location.origin}/p/${record.id}?t=${record.token}`;
  const qr = await QRCode.toDataURL(url, {
    margin: 1,
    width: 512,
    color: { dark: "#111111", light: "#ffffff" },
  });
  return { url, qr };
}

export function ShareSheet({
  photo,
  file,
  roomCode,
  captureId,
  onPhoto,
  onClose,
}: {
  photo: PhotoRecord | null;
  file?: Blob | null;
  roomCode: string;
  captureId?: string;
  onPhoto?: (photo: PhotoRecord) => void;
  onClose: () => void;
}) {
  const [qr, setQr] = useState<string | null>(null);
  const [status, setStatus] = useState("QR készítése…");

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      let record = photo;
      if (!record && file) {
        const form = new FormData();
        form.set("file", file, "photobooth.jpg");
        form.set("roomCode", roomCode);
        if (captureId) form.set("captureId", captureId);
        const res = await fetch("/api/photos", { method: "POST", body: form });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.photo) {
          if (!cancelled) {
            setStatus(
              typeof data.error === "string"
                ? data.error
                : "A fotó még nem tölthető fel. Próbáld újra.",
            );
          }
          return;
        }
        record = data.photo as PhotoRecord;
        onPhoto?.(record);
      }
      if (!record) {
        if (!cancelled) setStatus("A fotó még nem elérhető.");
        return;
      }
      try {
        const made = await makeQr(record);
        if (!cancelled) {
          setQr(made.qr);
          setStatus("");
        }
      } catch {
        if (!cancelled) setStatus("A QR-kód nem készült el.");
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
    // onPhoto szándékosan kimarad: a parent state frissítése ne indítsa újra a feltöltést
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, file, roomCode, captureId]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-[2rem] border border-white/10 bg-[#0c0c0c] p-8 text-white shadow-2xl">
        <p className="text-sm tracking-[0.4em] text-[#c4a35a]">QR-KÓD</p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="Letöltési QR-kód"
            className="h-72 w-72 rounded-3xl bg-white p-4 sm:h-80 sm:w-80"
          />
        ) : (
          <div className="h-72 w-72 animate-pulse rounded-3xl bg-white/10 sm:h-80 sm:w-80" />
        )}
        <p className="max-w-sm text-center text-base text-white/70">
          {status || "Olvasd be a telefonoddal, és töltsd le a fotót."}
        </p>
        <KioskButton variant="ghost" onClick={onClose}>
          Kész
        </KioskButton>
      </div>
    </div>
  );
}
