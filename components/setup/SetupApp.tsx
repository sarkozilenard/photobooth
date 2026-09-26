"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import QRCode from "qrcode";
import { KioskButton } from "@/components/ui/KioskButton";

export function SetupApp() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [join, setJoin] = useState("");
  const [origin, setOrigin] = useState("");
  const [qr, setQr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!code || !origin) return;
    void QRCode.toDataURL(`${origin}/camera/${code}`, {
      width: 420,
      margin: 1,
      color: { dark: "#111111", light: "#ffffff" },
    }).then(setQr);
  }, [code, origin]);

  async function createBooth() {
    setBusy(true);
    const res = await fetch("/api/rooms", { method: "POST" });
    const data = await res.json();
    setCode(data.room.code);
    setBusy(false);
  }

  function openBooth(event?: FormEvent, local = false) {
    event?.preventDefault();
    const value = (code || join).toUpperCase();
    if (!value) return;
    router.push(`/booth/${value}${local ? "?local=1" : ""}`);
  }

  return (
    <div className="min-h-[100dvh] bg-black px-6 py-10 text-white">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-10">
        <header className="text-center">
          <p className="text-xs tracking-[0.6em] text-[#c4a35a]">DIY SYSTEM</p>
          <h1 className="mt-4 font-serif text-5xl sm:text-7xl">PHOTO BOOTH</h1>
          <p className="mx-auto mt-4 max-w-xl text-white/60">
            iPhone a kamera, iPad a vendégkijelző. Felhőből, helyi szerver nélkül.
          </p>
        </header>

        {!code ? (
          <div className="flex flex-col items-center gap-4">
            <KioskButton disabled={busy} onClick={() => void createBooth()}>
              Új booth
            </KioskButton>
            <form
              className="flex w-full max-w-md flex-col gap-3 sm:flex-row"
              onSubmit={(e) => openBooth(e)}
            >
              <label className="sr-only" htmlFor="join-code">
                Booth kód
              </label>
              <input
                id="join-code"
                value={join}
                onChange={(e) => setJoin(e.target.value.toUpperCase())}
                placeholder="KÓD"
                className="min-h-16 flex-1 rounded-full border border-white/15 bg-white/5 px-6 text-center tracking-[0.4em] outline-none"
              />
              <KioskButton type="submit" variant="ghost">
                Megnyitás
              </KioskButton>
            </form>
          </div>
        ) : (
          <div className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-8 md:grid-cols-2">
            <div className="flex flex-col items-center gap-4">
              {qr ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qr} alt="iPhone kamera QR" className="w-56 rounded-2xl bg-white p-3" />
              ) : null}
              <p className="text-4xl tracking-[0.4em]">{code}</p>
              <p className="text-center text-sm text-white/60">
                Olvasd be iPhone-nal, vagy nyisd meg:
                <br />
                <span className="break-all text-white">{origin}/camera/{code}</span>
              </p>
            </div>
            <div className="flex flex-col justify-center gap-4">
              <KioskButton onClick={() => openBooth()}>iPad booth</KioskButton>
              <KioskButton variant="ghost" onClick={() => router.push(`/camera/${code}`)}>
                iPhone kamera
              </KioskButton>
              <KioskButton variant="ghost" onClick={() => openBooth(undefined, true)}>
                Teszt helyi kamerával
              </KioskButton>
            </div>
          </div>
        )}

        <ol className="grid gap-4 text-sm text-white/65 md:grid-cols-3">
          <li className="rounded-3xl border border-white/10 p-5">
            1. Az iPaden nyisd meg a boothot, tedd teljes képernyőre.
          </li>
          <li className="rounded-3xl border border-white/10 p-5">
            2. Az iPhone-on indítsd a kamerát, rögzítsd a ring light elé.
          </li>
          <li className="rounded-3xl border border-white/10 p-5">
            3. A vendég a lookot koppintja, aztán Fotózás.
          </li>
        </ol>

        <div className="flex justify-center">
          <a className="text-sm tracking-[0.3em] text-white/40 uppercase" href="/admin">
            Admin
          </a>
        </div>
      </div>
    </div>
  );
}
