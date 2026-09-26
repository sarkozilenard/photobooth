"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { KioskButton } from "@/components/ui/KioskButton";
import { uploadFinishedPhoto } from "@/lib/photos/client-upload";
import { PhotoRecord } from "@/lib/types";

async function makeQr(url: string) {
  return QRCode.toDataURL(url, {
    margin: 1,
    width: 512,
    color: { dark: "#111111", light: "#ffffff" },
  });
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
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      setQr(null);
      setStatus("QR készítése…");
      if (!photo && !file) {
        if (!cancelled) setStatus("Előbb készíts fotót, aztán nyisd meg a QR-t.");
        return;
      }
      const origin = window.location.origin;
      const boothUrl = `${origin}/s/${roomCode}`;
      try {
        if (photo) {
          const image = await makeQr(`${origin}/p/${photo.id}?t=${photo.token}`);
          if (!cancelled) {
            setQr(image);
            setStatus("Olvasd be a telefonoddal. A fotó az iPadre is mentve.");
          }
          return;
        }
        const image = await makeQr(boothUrl);
        if (!cancelled) {
          setQr(image);
          setStatus(
            "Olvasd be a QR-t. Az iPad maradjon nyitva, amíg a telefon lekéri a fotót.",
          );
        }
        if (file) {
          try {
            const record = await uploadFinishedPhoto({
              file,
              roomCode,
              captureId,
            });
            if (cancelled) return;
            onPhoto?.(record);
            const cloud = await makeQr(`${origin}/p/${record.id}?t=${record.token}`);
            if (!cancelled) {
              setQr(cloud);
              setStatus("Olvasd be a telefonoddal. A fotó az iPadre is mentve.");
            }
          } catch {
            /* a booth QR Blob nélkül is megy */
          }
        }
      } catch {
        if (!cancelled) setStatus("A QR-kód nem készült el.");
      }
    }

    void prepare();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photo, file, roomCode, captureId, retry]);

  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80 p-6 backdrop-blur-md">
      <div className="flex w-full max-w-lg flex-col items-center gap-6 rounded-[2rem] border border-white/10 bg-[#0c0c0c] p-8 text-white shadow-2xl">
        <p className="text-sm tracking-[0.4em] text-accent">QR-KÓD</p>
        {qr ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qr}
            alt="Letöltési QR-kód"
            className="h-72 w-72 rounded-3xl bg-white p-4 sm:h-80 sm:w-80"
          />
        ) : (
          <div className="h-72 w-72 animate-pulse rounded-3xl bg-white/10" />
        )}
        <p className="max-w-sm text-center text-base leading-relaxed text-white/70">
          {status}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          {!qr ? (
            <KioskButton variant="gold" onClick={() => setRetry((n) => n + 1)}>
              Újra
            </KioskButton>
          ) : null}
          <KioskButton variant="ghost" onClick={onClose}>
            Kész
          </KioskButton>
        </div>
      </div>
    </div>
  );
}
