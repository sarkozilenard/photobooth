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

async function readError(res: Response) {
  const text = await res.text();
  try {
    const data = JSON.parse(text) as { error?: unknown };
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  } catch {
    /* HTML / üres válasz */
  }
  if (res.status === 413) return "A fotó túl nagy a feltöltéshez.";
  if (res.status === 404) return "A booth nem található. Frissítsd az oldalt.";
  if (res.status === 503) {
    return "A QR-hez Vercel Blob kell: Vercel → Storage → Blob → Connect, majd Redeploy.";
  }
  return text.trim().slice(0, 180) || `Feltöltés sikertelen (${res.status}).`;
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
      setStatus("Feltöltés…");
      let record = photo;
      if (!record && file) {
        const upload = new File([file], "photobooth.jpg", {
          type: file.type || "image/jpeg",
        });
        const form = new FormData();
        form.set("file", upload);
        form.set("roomCode", roomCode);
        if (captureId) form.set("captureId", captureId);
        const res = await fetch("/api/photos", { method: "POST", body: form });
        if (!res.ok) {
          if (!cancelled) setStatus(await readError(res));
          return;
        }
        const data = (await res.json().catch(() => ({}))) as { photo?: PhotoRecord };
        if (!data.photo) {
          if (!cancelled) setStatus("A szerver nem adta vissza a fotót. Próbáld újra.");
          return;
        }
        record = data.photo;
        onPhoto?.(record);
      }
      if (!record) {
        if (!cancelled) setStatus("Előbb készíts fotót, aztán nyisd meg a QR-t.");
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
  }, [photo, file, roomCode, captureId, retry]);

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
