"use client";

import { FormEvent, useEffect, useState } from "react";
import { KioskButton } from "@/components/ui/KioskButton";
import { PhotoRecord } from "@/lib/types";

export function ShareSheet({
  photo,
  file,
  onClose,
}: {
  photo: PhotoRecord | null;
  file?: Blob | null;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"menu" | "email" | "qr">("menu");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [qr, setQr] = useState<{ url: string; qr: string } | null>(null);

  useEffect(() => {
    if (mode !== "qr" || !photo) return;
    void fetch(`/api/share/qr?photoId=${photo.id}`)
      .then((r) => r.json())
      .then(setQr);
  }, [mode, photo]);

  async function shareNative() {
    setStatus("");
    const blob =
      file ||
      (photo
        ? await (await fetch(`/api/photos/${photo.id}/file?t=${photo.token}`)).blob()
        : null);
    if (!blob) {
      setStatus("A fotó még nem elérhető.");
      return;
    }
    const fileOut = new File([blob], `photobooth-${photo?.id ?? "shot"}.jpg`, {
      type: blob.type || "image/jpeg",
    });
    if (navigator.canShare?.({ files: [fileOut] })) {
      await navigator.share({
        files: [fileOut],
        title: "PHOTO BOOTH",
        text: "Fotó a boothból",
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileOut.name;
    a.click();
    setStatus("A natív megosztás nem elérhető, a kép letöltődött.");
  }

  async function sendEmail(event: FormEvent) {
    event.preventDefault();
    if (!photo) {
      setStatus("A fotó még nincs a felhőben.");
      return;
    }
    setStatus("Küldés...");
    const res = await fetch("/api/share/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photoId: photo.id, email }),
    });
    const data = await res.json();
    if (!res.ok) {
      setStatus(data.error || "Sikertelen");
      return;
    }
    setStatus(
      data.delivered
        ? "Elküldve."
        : `Link: ${data.link}`,
    );
  }

  return (
    <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/70 p-6 backdrop-blur-md">
      <div className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-[#0c0c0c] p-8 text-white shadow-2xl">
        {mode === "menu" && (
          <div className="flex flex-col gap-4">
            <p className="text-center text-sm tracking-[0.4em] text-[#c4a35a]">
              MEGOSZTÁS
            </p>
            <KioskButton onClick={() => void shareNative()}>AirDrop</KioskButton>
            <KioskButton variant="ghost" onClick={() => setMode("email")} disabled={!photo}>
              E-mail
            </KioskButton>
            <KioskButton variant="ghost" onClick={() => setMode("qr")} disabled={!photo}>
              QR-kód
            </KioskButton>
            <KioskButton variant="ghost" onClick={onClose}>
              Bezárás
            </KioskButton>
            {status ? (
              <p className="text-center text-sm text-white/70">{status}</p>
            ) : null}
          </div>
        )}

        {mode === "email" && (
          <form className="flex flex-col gap-4" onSubmit={(e) => void sendEmail(e)}>
            <p className="text-center text-sm tracking-[0.4em] text-[#c4a35a]">
              E-MAIL
            </p>
            <label className="text-sm text-white/70" htmlFor="guest-email">
              E-mail cím
            </label>
            <input
              id="guest-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-h-14 rounded-2xl border border-white/15 bg-white/5 px-4 text-lg outline-none ring-[#c4a35a] focus:ring-2"
              placeholder="vendeg@email.com"
            />
            <KioskButton type="submit">Küldés</KioskButton>
            <KioskButton variant="ghost" onClick={() => setMode("menu")}>
              Vissza
            </KioskButton>
            {status ? (
              <p className="break-all text-center text-sm text-white/70">{status}</p>
            ) : null}
          </form>
        )}

        {mode === "qr" && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm tracking-[0.4em] text-[#c4a35a]">QR-KÓD</p>
            {qr ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={qr.qr}
                alt="Letöltési QR-kód"
                className="h-64 w-64 rounded-2xl bg-white p-3"
              />
            ) : (
              <div className="h-64 w-64 animate-pulse rounded-2xl bg-white/10" />
            )}
            <p className="max-w-sm text-center text-sm text-white/60">
              Olvasd be a telefonoddal a letöltéshez.
            </p>
            <KioskButton variant="ghost" onClick={() => setMode("menu")}>
              Vissza
            </KioskButton>
          </div>
        )}
      </div>
    </div>
  );
}
