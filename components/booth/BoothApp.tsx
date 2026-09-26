"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GuestChooser } from "@/components/booth/GuestChooser";
import { LookStrip } from "@/components/booth/LookGrid";
import { LookOverlay } from "@/components/booth/LookOverlay";
import { ShareSheet } from "@/components/share/ShareSheet";
import { KioskButton } from "@/components/ui/KioskButton";
import { FRAMES } from "@/lib/booth/guest-presets";
import { createRingLightDriver } from "@/lib/hardware/ring-light";
import { playCountdownBeep, playShutter, resumeAudio } from "@/lib/sounds";
import { BoothSettings, DEFAULT_SETTINGS, FrameStyle, LayoutStyle, PhotoRecord } from "@/lib/types";
import { LiveLink, startBoothLive } from "@/lib/webrtc/live";
import { attachStream, captureFromVideo, getCameraStream } from "@/lib/camera/capture";
import { composeSession, loadRoomLogo } from "@/lib/branding/compose";
import { BoothLook, DEFAULT_LOOK } from "@/lib/effects/looks";
import { createId } from "@/lib/ids";

type Phase = "attract" | "live" | "countdown" | "preview";

export function BoothApp({
  code,
  localCamera = false,
}: {
  code: string;
  localCamera?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<LiveLink | null>(null);
  const seenRef = useRef(new Set<string>());
  const [settings, setSettings] = useState<BoothSettings | null>(null);
  const [phase, setPhase] = useState<Phase>("live");
  const [look, setLook] = useState<BoothLook>(DEFAULT_LOOK);
  const lookRef = useRef(look);
  lookRef.current = look;
  const [photosPerRound, setPhotosPerRound] = useState(3);
  const [layoutStyle, setLayoutStyle] = useState<LayoutStyle>("strip");
  const [frameStyle, setFrameStyle] = useState<FrameStyle>("booth");
  const [countdownSeconds, setCountdownSeconds] = useState(3);
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [flashEnabled, setFlashEnabled] = useState(true);
  const guestSeeded = useRef(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [photo, setPhoto] = useState<PhotoRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<Blob | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cameraOnline, setCameraOnline] = useState(localCamera);
  const [connection, setConnection] = useState("új kapcsolat");
  const [busy, setBusy] = useState(false);
  const [shotUrls, setShotUrls] = useState<string[]>([]);
  const [shotLabel, setShotLabel] = useState("");
  const sessionRef = useRef(false);
  const shotsRef = useRef<Blob[]>([]);
  const holdRef = useRef<number | null>(null);
  const ring = useRef(createRingLightDriver());

  const loadSettings = useCallback(async () => {
    const res = await fetch(`/api/rooms/${code}`);
    const data = await res.json();
    setSettings((prev) => (settingsOpen ? prev : data.settings));
    if (!guestSeeded.current && data.settings) {
      guestSeeded.current = true;
      setPhotosPerRound(data.settings.photosPerRound ?? 3);
      setLayoutStyle(data.settings.layoutStyle ?? "strip");
      setFrameStyle(
        data.settings.frameStyle === "classic"
          ? "booth"
          : (data.settings.frameStyle ?? "booth"),
      );
      setCountdownSeconds(data.settings.countdownSeconds ?? 3);
      setSoundsEnabled(data.settings.soundsEnabled ?? true);
      setFlashEnabled(data.settings.flashEnabled ?? true);
    }
  }, [code, settingsOpen]);

  useEffect(() => {
    void loadSettings();
    const id = window.setInterval(() => void loadSettings(), 3000);
    return () => window.clearInterval(id);
  }, [loadSettings]);

  useEffect(() => {
    void ring.current.setPower(true);
    const video = videoRef.current;
    if (!video) return;

    if (localCamera) {
      let stream: MediaStream | null = null;
      void (async () => {
        stream = await getCameraStream("user");
        await attachStream(video, stream);
        setStream(stream);
        setCameraOnline(true);
        setConnection("helyi kamera");
      })();
      return () => stream?.getTracks().forEach((track) => track.stop());
    }

    let stop: () => void = () => {};
    void (async () => {
      const peer = await startBoothLive({
        code,
        onStream: (media) => {
          void attachStream(video, media);
          setStream(media);
          setCameraOnline(true);
        },
        onStatus: (text) => {
          setConnection(text);
          if (
            text.includes("élő") ||
            text.includes("csatlakozott") ||
            text.includes("kép")
          ) {
            setCameraOnline(true);
          }
        },
        onPhoto: (blob) => {
          if (sessionRef.current) return;
          setLocalFile(blob);
          setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
          setPhase("preview");
          setBusy(false);
        },
        onControl: (msg) => {
          const key = `${msg.action}:${msg.captureId ?? ""}`;
          if (seenRef.current.has(key)) return;
          seenRef.current.add(key);
          if (msg.action === "photo-ready" && msg.photoId && msg.photoToken) {
            if (sessionRef.current) return;
            void fetch(`/api/photos/${msg.photoId}?t=${msg.photoToken}`)
              .then((r) => r.json())
              .then((data) => {
                if (data.photo) {
                  setPhoto(data.photo);
                  setPhase("preview");
                  setBusy(false);
                }
              });
          }
        },
      });
      peerRef.current = peer;
      stop = () => peer.close();
    })();

    return () => stop();
  }, [code, localCamera]);

  async function captureCurrent(captureId: string) {
    if (!videoRef.current || videoRef.current.videoWidth <= 0) return null;
    return captureFromVideo(
      videoRef.current,
      {
        captureId,
        quality: settings?.jpegQuality ?? 0.92,
        maxEdge: settings?.maxEdge ?? 2560,
      },
      lookRef.current,
    );
  }

  async function runCountdown(captureId: string, seconds: number) {
    setPhase("countdown");
    for (let n = seconds; n >= 1; n -= 1) {
      setCount(n);
      if (soundsEnabled) playCountdownBeep(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCount(null);
    if (flashEnabled) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 140);
    }
    if (soundsEnabled) playShutter();
    await peerRef.current?.sendControl({ action: "capture", captureId });
    return captureCurrent(captureId);
  }

  async function startShoot() {
    if (busy || (!cameraOnline && !localCamera)) return;
    setBusy(true);
    sessionRef.current = true;
    await resumeAudio();
    try {
      await document.documentElement.requestFullscreen?.();
    } catch {
      /* kiosk optional */
    }

    const seconds = countdownSeconds;
    const total = photosPerRound;
    const shots: Blob[] = [];
    const urls: string[] = [];

    try {
      for (let index = 0; index < total; index += 1) {
        setShotLabel(total > 1 ? `${index + 1} / ${total}` : "");
        const captureId = createId();
        await peerRef.current?.sendControl({
          action: "start-countdown",
          captureId,
          value: seconds,
        });
        const blob = await runCountdown(captureId, seconds);
        if (blob) {
          shots.push(blob);
          urls.push(URL.createObjectURL(blob));
          setShotUrls([...urls]);
        }
        if (index < total - 1) {
          setPhase("live");
          await new Promise((r) => setTimeout(r, 900));
        }
      }

      if (shots.length === 0) return;
      shotsRef.current = shots;
      const current = {
        ...(settings ?? DEFAULT_SETTINGS),
        frameStyle,
        layoutStyle,
      };
      const logo = await loadRoomLogo(code, current.hasLogo);
      const strip = await composeSession(shots, current, logo);
      setLocalFile(strip);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(strip);
      });
      setPhase("preview");
      const form = new FormData();
      form.set("file", strip, "session.jpg");
      form.set("roomCode", code);
      const res = await fetch("/api/photos", { method: "POST", body: form });
      const data = await res.json().catch(() => ({}));
      if (data.photo) setPhoto(data.photo);
    } finally {
      sessionRef.current = false;
      setBusy(false);
      setShotLabel("");
      setCount(null);
    }
  }

  function reset() {
    setPhase("live");
    setPhoto(null);
    setLocalFile(null);
    shotsRef.current = [];
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setShotUrls((prev) => {
      prev.forEach((url) => URL.revokeObjectURL(url));
      return [];
    });
    setShareOpen(false);
    setBusy(false);
    setCount(null);
    setShotLabel("");
  }

  function pickLook(next: BoothLook) {
    setLook(next);
  }

  async function recompose(nextFrame?: FrameStyle) {
    if (shotsRef.current.length === 0) return;
    const style = nextFrame ?? frameStyle;
    if (nextFrame) setFrameStyle(nextFrame);
    const current = {
      ...(settings ?? DEFAULT_SETTINGS),
      frameStyle: style,
      layoutStyle,
    };
    const logo = await loadRoomLogo(code, current.hasLogo);
    const strip = await composeSession(shotsRef.current, current, logo);
    setLocalFile(strip);
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(strip);
    });
    setPhoto(null);
  }

  function beginOperatorHold() {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = window.setTimeout(() => setSettingsOpen(true), 900);
  }

  function endOperatorHold() {
    if (holdRef.current) window.clearTimeout(holdRef.current);
    holdRef.current = null;
  }

  const title = settings?.name || "PHOTO BOOTH";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      <div
        className={`relative absolute inset-0 flex items-center justify-center bg-black transition duration-500 ${
          phase === "preview" ? "opacity-0" : "opacity-100"
        }`}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          style={{ filter: look.filter }}
          playsInline
          muted
          autoPlay
        />
        {phase !== "preview" ? <LookOverlay look={look} /> : null}
      </div>

      {(photo || previewUrl) && phase === "preview" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={
            previewUrl ||
            `/api/photos/${photo?.id}/file?t=${photo?.token}`
          }
          alt="Elkészült fotó"
          className="absolute inset-0 h-full w-full object-contain bg-black"
        />
      ) : null}

      {flash ? <div className="absolute inset-0 z-20 bg-white/90 animate-[pulse_140ms_ease-out]" /> : null}

      {phase === "countdown" && count ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
          {shotLabel ? (
            <p className="mb-2 text-sm tracking-[0.4em] text-[#c4a35a]">{shotLabel}</p>
          ) : null}
          <span className="font-serif text-[30vw] leading-none text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.35)]">
            {count}
          </span>
        </div>
      ) : null}

      <header className="absolute left-0 right-0 top-0 z-20 flex items-start justify-between p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div
          onPointerDown={beginOperatorHold}
          onPointerUp={endOperatorHold}
          onPointerCancel={endOperatorHold}
          onPointerLeave={endOperatorHold}
        >
          <p className="text-xs tracking-[0.5em] text-[#c4a35a]">{title}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-white/50">
            {cameraOnline
              ? `${photosPerRound} fotó · ${look.label} · ${countdownSeconds} mp`
              : "Kamera várakozik"}
            {` · ${connection}`}
          </p>
        </div>
        <div
          className={`h-3 w-3 rounded-full ${cameraOnline ? "bg-emerald-400" : "bg-white/30"}`}
          aria-label={cameraOnline ? "Kamera csatlakozva" : "Kamera nincs csatlakozva"}
        />
      </header>

      {!cameraOnline && phase !== "preview" ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/50 p-8 text-center">
          <p className="font-serif text-4xl">Kamera csatlakoztatása</p>
          <p className="max-w-md text-white/70">
            Nyisd meg az iPhone-on a kamera oldalt, és engedélyezd a kamerát.
          </p>
          <p className="rounded-full border border-white/20 px-5 py-2 tracking-[0.4em]">
            {code}
          </p>
        </div>
      ) : null}

      {phase === "live" && cameraOnline && !busy ? (
        <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/80 to-transparent pt-10">
          <div className="flex flex-col items-center gap-3 px-3 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <LookStrip stream={stream} selectedId={look.id} onSelect={pickLook} />
            <GuestChooser
              photos={photosPerRound}
              layout={layoutStyle}
              frame={frameStyle}
              countdown={countdownSeconds}
              onExperience={(preset) => {
                setPhotosPerRound(preset.photos);
                setLayoutStyle(preset.layout);
              }}
              onFrame={(preset) => setFrameStyle(preset.id)}
              onCountdown={setCountdownSeconds}
            />
            <KioskButton
              className="min-h-16 min-w-[16rem] text-xl"
              disabled={!cameraOnline}
              onClick={() => void startShoot()}
            >
              Fotózás
            </KioskButton>
          </div>
        </div>
      ) : null}

      {phase === "preview" && (photo || localFile) ? (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-3 bg-gradient-to-t from-black via-black/90 to-transparent p-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:p-6">
          <p className="text-[11px] tracking-[0.28em] text-[#c4a35a] uppercase">
            Sablon a kész fotón
          </p>
          <div className="flex max-w-full gap-2 overflow-x-auto">
            {FRAMES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`min-h-12 shrink-0 rounded-full px-4 text-sm font-semibold ${
                  frameStyle === preset.id ? "bg-white text-black" : "bg-white/15"
                }`}
                onClick={() => void recompose(preset.id)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {shotUrls.length > 1 ? (
            <div className="flex gap-2">
              {shotUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="h-16 w-24 rounded-lg object-contain bg-black ring-1 ring-white/20"
                />
              ))}
            </div>
          ) : null}
          <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <KioskButton variant="ghost" onClick={reset}>
              Új fotó
            </KioskButton>
            <KioskButton variant="gold" onClick={() => setShareOpen(true)}>
              QR-kód
            </KioskButton>
          </div>
        </div>
      ) : null}

      {shareOpen ? (
        <ShareSheet
          photo={photo}
          file={localFile}
          roomCode={code}
          onPhoto={setPhoto}
          onClose={() => setShareOpen(false)}
        />
      ) : null}

      {settingsOpen && settings ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0c0c0c] p-6 text-white">
            <p className="text-sm tracking-[0.35em] text-[#c4a35a]">BOOTH</p>
            <h2 className="mt-2 font-serif text-3xl">Beállítások</h2>
            <div className="mt-6 grid gap-4">
              <label className="flex flex-col gap-2 text-sm">
                Visszaszámláló: {settings.countdownSeconds} mp
                <input
                  type="range"
                  min={1}
                  max={20}
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
                  max={4}
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
              <label className="flex flex-col gap-2 text-sm">
                Elrendezés
                <select
                  value={settings.layoutStyle ?? "strip"}
                  className="min-h-11 rounded-xl border border-white/10 bg-black px-3"
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      layoutStyle: e.target.value as BoothSettings["layoutStyle"],
                    })
                  }
                >
                  <option value="strip">Csík (egymás alatt)</option>
                  <option value="grid">Rács</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Keret
                <select
                  value={settings.frameStyle}
                  className="min-h-11 rounded-xl border border-white/10 bg-black px-3"
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      frameStyle: e.target.value as BoothSettings["frameStyle"],
                    })
                  }
                >
                  <option value="booth">Booth csík</option>
                  <option value="none">Nincs keret</option>
                  <option value="gold">Arany</option>
                  <option value="minimal">Minimal</option>
                </select>
              </label>
            </div>
            <div className="mt-6 flex gap-3">
              <KioskButton variant="ghost" onClick={() => setSettingsOpen(false)}>
                Mégse
              </KioskButton>
              <KioskButton
                variant="gold"
                onClick={() => {
                  void fetch(`/api/rooms/${code}`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ settings }),
                  }).then(async (res) => {
                    const data = await res.json();
                    if (data.settings) setSettings(data.settings);
                    setSettingsOpen(false);
                  });
                }}
              >
                Mentés
              </KioskButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
