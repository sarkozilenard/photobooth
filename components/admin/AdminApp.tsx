"use client";

import { FormEvent, useEffect, useState } from "react";
import { BoothSettings, DEFAULT_SETTINGS, PhotoRecord } from "@/lib/types";

export function AdminApp() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [room, setRoom] = useState("");
  const [photos, setPhotos] = useState<PhotoRecord[]>([]);
  const [settings, setSettings] = useState<BoothSettings | null>(null);
  const [logoStamp, setLogoStamp] = useState(0);

  async function check() {
    const res = await fetch("/api/admin/session");
    const data = await res.json();
    setAuthed(Boolean(data.ok));
  }

  useEffect(() => {
    void check();
  }, []);

  async function login(event: FormEvent) {
    event.preventDefault();
    setError("");
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Hibás jelszó");
      return;
    }
    setAuthed(true);
  }

  async function load(code = room) {
    setError("");
    const booth = code.trim().toUpperCase();
    const query = booth ? `?room=${booth}` : "";
    const res = await fetch(`/api/photos${query}`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "A fotók nem tölthetők be. Jelentkezz be újra.");
      setPhotos([]);
      return;
    }
    setPhotos(data.photos ?? []);
    if (booth) {
      const s = await fetch(`/api/settings?room=${booth}`);
      const json = await s.json().catch(() => ({}));
      if (!s.ok) {
        setError(json.error || "A beállítások nem tölthetők be.");
        return;
      }
      setSettings({ ...DEFAULT_SETTINGS, ...json.settings });
    }
  }

  useEffect(() => {
    if (authed) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authed]);

  async function saveSettings(event: FormEvent) {
    event.preventDefault();
    if (!settings || !room) return;
    setError("");
    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room: room.toUpperCase(), settings }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "A beállítások mentése nem sikerült");
      return;
    }
    if (data.settings) setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
  }

  async function uploadLogo(file: File | null) {
    if (!file || !room) return;
    const form = new FormData();
    form.set("file", file);
    const res = await fetch(`/api/branding/${room.toUpperCase()}/logo`, {
      method: "POST",
      body: form,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "A logó feltöltése nem sikerült");
      return;
    }
    setError("");
    setSettings((current) =>
      current ? { ...current, hasLogo: true } : current,
    );
    setLogoStamp(Date.now());
  }

  async function removeLogo() {
    if (!room) return;
    await fetch(`/api/branding/${room.toUpperCase()}/logo`, { method: "DELETE" });
    setSettings((current) =>
      current ? { ...current, hasLogo: false } : current,
    );
  }

  async function remove(id: string) {
    await fetch(`/api/photos/${id}`, { method: "DELETE" });
    await load();
  }

  if (authed === null) {
    return <div className="min-h-[100dvh] bg-black text-white">Betöltés…</div>;
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black p-6 text-white">
        <form
          onSubmit={(e) => void login(e)}
          className="w-full max-w-sm rounded-[2rem] border border-white/10 bg-white/5 p-8"
        >
          <h1 className="font-serif text-3xl">Admin</h1>
          <label className="mt-6 block text-sm text-white/70" htmlFor="admin-pass">
            Jelszó
          </label>
          <input
            id="admin-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-2 min-h-12 w-full rounded-2xl border border-white/15 bg-black px-4"
          />
          {error ? <p className="mt-3 text-sm text-red-300">{error}</p> : null}
          <button className="mt-6 min-h-12 w-full rounded-full bg-white font-semibold tracking-[0.2em] text-black uppercase">
            Belépés
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-black p-6 text-white md:p-10">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="flex items-center justify-between">
          <h1 className="font-serif text-4xl">Admin</h1>
          <button
            className="text-sm text-white/50"
            onClick={() => void fetch("/api/admin/logout", { method: "POST" }).then(() => setAuthed(false))}
          >
            Kilépés
          </button>
        </header>

        {error && !settings ? (
          <p className="text-sm text-red-300">{error}</p>
        ) : null}

        <form
          className="flex flex-wrap gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const booth = String(new FormData(e.currentTarget).get("room") || "")
              .trim()
              .toUpperCase();
            setRoom(booth);
            void load(booth);
          }}
        >
          <label className="sr-only" htmlFor="room-filter">
            Booth kód
          </label>
          <input
            id="room-filter"
            name="room"
            value={room}
            onChange={(e) => setRoom(e.target.value.toUpperCase())}
            placeholder="BOOTH KÓD"
            className="min-h-12 rounded-full border border-white/15 bg-white/5 px-5 tracking-[0.3em]"
          />
          <button className="rounded-full bg-white px-6 text-sm font-semibold tracking-[0.2em] text-black uppercase">
            Szűrés
          </button>
        </form>

        {settings ? (
          <form
            onSubmit={(e) => void saveSettings(e)}
            className="grid gap-4 rounded-[1.5rem] border border-white/10 p-6 md:grid-cols-2"
          >
            {error ? (
              <p className="text-sm text-red-300 md:col-span-2">{error}</p>
            ) : null}
            <label className="flex flex-col gap-2 text-sm">
              Booth név
              <input
                value={settings.name}
                onChange={(e) => setSettings({ ...settings, name: e.target.value })}
                className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Esemény felirat
              <input
                value={settings.eventCaption}
                onChange={(e) =>
                  setSettings({ ...settings, eventCaption: e.target.value })
                }
                placeholder="pl. Anna & Márk · 2026"
                className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3"
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Visszaszámláló (mp): {settings.countdownSeconds}
              <input
                type="range"
                min={1}
                max={20}
                step={1}
                value={settings.countdownSeconds}
                className="accent-[#c4a35a]"
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    countdownSeconds: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Fotók egy körben: {settings.photosPerRound}
              <input
                type="range"
                min={1}
                max={6}
                step={1}
                value={settings.photosPerRound}
                className="accent-[#c4a35a]"
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    photosPerRound: Number(e.target.value),
                  })
                }
              />
            </label>
            <label className="flex flex-col gap-2 text-sm md:col-span-2">
              Logó
              {settings.hasLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/branding/${room}/logo?t=${logoStamp}`}
                  alt="Feltöltött logó"
                  className="h-20 w-auto max-w-xs object-contain rounded-xl bg-white/5 p-2"
                />
              ) : (
                <p className="text-white/40">Még nincs logó.</p>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="text-sm file:mr-4 file:rounded-full file:border-0 file:bg-white file:px-4 file:py-2 file:text-black"
                onChange={(e) => void uploadLogo(e.target.files?.[0] ?? null)}
              />
              {settings.hasLogo ? (
                <button
                  type="button"
                  className="w-fit text-sm text-white/50 underline"
                  onClick={() => void removeLogo()}
                >
                  Logó törlése
                </button>
              ) : null}
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Keret
              <select
                value={settings.frameStyle}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    frameStyle: e.target.value as BoothSettings["frameStyle"],
                  })
                }
                className="min-h-11 rounded-xl border border-white/10 bg-black px-3"
              >
                <option value="booth">Booth csík</option>
                <option value="none">Nincs keret</option>
                <option value="gold">Arany</option>
                <option value="minimal">Minimal</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Elrendezés
              <select
                value={settings.layoutStyle ?? "strip"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    layoutStyle: e.target.value as BoothSettings["layoutStyle"],
                  })
                }
                className="min-h-11 rounded-xl border border-white/10 bg-black px-3"
              >
                <option value="strip">Csík</option>
                <option value="grid">Rács</option>
              </select>
            </label>
            <label className="flex flex-col gap-2 text-sm">
              JPEG minőség ({settings.jpegQuality})
              <input
                type="range"
                min={0.6}
                max={0.98}
                step={0.01}
                value={settings.jpegQuality}
                className="accent-[#c4a35a]"
                onChange={(e) =>
                  setSettings({ ...settings, jpegQuality: Number(e.target.value) })
                }
              />
            </label>
            <label className="flex flex-col gap-2 text-sm">
              Max él (px)
              <input
                type="number"
                value={settings.maxEdge}
                onChange={(e) =>
                  setSettings({ ...settings, maxEdge: Number(e.target.value) })
                }
                className="min-h-11 rounded-xl border border-white/10 bg-white/5 px-3"
              />
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.soundsEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, soundsEnabled: e.target.checked })
                }
              />
              Hangok
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.flashEnabled}
                onChange={(e) =>
                  setSettings({ ...settings, flashEnabled: e.target.checked })
                }
              />
              Flash effekt
            </label>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={settings.ringLightAlwaysOn}
                onChange={(e) =>
                  setSettings({ ...settings, ringLightAlwaysOn: e.target.checked })
                }
              />
              Ring light folyamatos (alap)
            </label>
            <button className="rounded-full bg-[#c4a35a] px-6 py-3 text-sm font-semibold tracking-[0.2em] text-black uppercase">
              Mentés
            </button>
          </form>
        ) : (
          <p className="text-sm text-white/50">
            Add meg a booth kódot a beállításokhoz.
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {photos.length === 0 ? (
            <p className="text-sm text-white/50 sm:col-span-2 lg:col-span-3">
              Még nincs fotó. Fotózz a booth-on, majd nyomj Szűrés-t.
            </p>
          ) : null}
          {photos.map((photo) => (
            <article
              key={photo.id}
              className="overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/5"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/photos/${photo.id}/file?t=${photo.token}`}
                alt=""
                className="aspect-[4/3] w-full bg-black object-contain"
              />
              <div className="flex items-center justify-between gap-2 p-4 text-xs text-white/70">
                <span>{photo.roomCode}</span>
                <span>{new Date(photo.createdAt).toLocaleString("hu-HU")}</span>
              </div>
              <div className="flex flex-wrap gap-2 px-4 pb-4">
                <a
                  className="rounded-full bg-white px-4 py-2 text-xs font-semibold tracking-[0.2em] text-black uppercase"
                  href={`/p/${photo.id}?t=${photo.token}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Megnyitás
                </a>
                <a
                  className="rounded-full border border-white/20 px-4 py-2 text-xs tracking-[0.2em] uppercase"
                  href={`/api/photos/${photo.id}/file?t=${photo.token}`}
                  download
                >
                  Letöltés
                </a>
                <button
                  className="rounded-full border border-white/20 px-4 py-2 text-xs tracking-[0.2em] uppercase"
                  onClick={() => void remove(photo.id)}
                >
                  Törlés
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
