"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GuestChooser } from "@/components/booth/GuestChooser";
import { LookStrip } from "@/components/booth/LookGrid";
import { LookOverlay } from "@/components/booth/LookOverlay";
import { ShareSheet } from "@/components/share/ShareSheet";
import { KioskButton } from "@/components/ui/KioskButton";
import { ASPECTS, AspectPreset, FRAMES, LAYOUTS } from "@/lib/booth/guest-presets";
import { createRingLightDriver } from "@/lib/hardware/ring-light";
import { playCountdownBeep, playShutter, resumeAudio } from "@/lib/sounds";
import { BoothSettings, DEFAULT_SETTINGS, FrameStyle, LayoutStyle, PhotoRecord } from "@/lib/types";
import { LiveLink, startBoothLive } from "@/lib/webrtc/live";
import {
  attachStream,
  cameraErrorMessage,
  captureFromVideo,
  getCameraStream,
} from "@/lib/camera/capture";
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
  const [aspect, setAspect] = useState<AspectPreset>(ASPECTS[0]);
  const aspectRef = useRef(aspect);
  aspectRef.current = aspect;
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
  const [cameraOnline, setCameraOnline] = useState(false);
  const [connection, setConnection] = useState("új kapcsolat");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [lookPoster, setLookPoster] = useState("");
  const composeGen = useRef(0);
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
      let media: MediaStream | null = null;
      void (async () => {
        try {
          media = await getCameraStream("user");
          await attachStream(video, media);
          setStream(media);
          setCameraOnline(true);
          setConnection("helyi kamera");
        } catch (error) {
          setCameraOnline(false);
          setConnection(cameraErrorMessage(error));
        }
      })();
      return () => media?.getTracks().forEach((track) => track.stop());
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

  useEffect(() => {
    if (phase === "preview") return;
    const tick = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth < 2) return;
      const canvas = document.createElement("canvas");
      canvas.width = 128;
      canvas.height = 96;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      setLookPoster(canvas.toDataURL("image/jpeg", 0.5));
    };
    tick();
    const id = window.setInterval(tick, 900);
    return () => window.clearInterval(id);
  }, [phase, stream]);

  async function captureCurrent(captureId: string) {
    if (!videoRef.current || videoRef.current.videoWidth <= 0) return null;
    return captureFromVideo(
      videoRef.current,
      {
        captureId,
        quality: settings?.jpegQuality ?? 0.92,
        maxEdge: settings?.maxEdge ?? 2560,
        aspectRatio: aspectRef.current.ratio,
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
          await new Promise((r) => setTimeout(r, 700));
        }
      }

      if (shots.length === 0) {
        setNotice("A fotó nem készült el. Próbáld újra.");
        setPhase("live");
        return;
      }
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
      setPhoto(null);
      setNotice("");
      setPhase("preview");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "A montázs nem készült el.");
      setPhase("live");
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
    setNotice("");
    void videoRef.current?.play().catch(() => undefined);
  }

  function pickLook(next: BoothLook) {
    setLook(next);
  }

  async function recompose(patch?: { frame?: FrameStyle; layout?: LayoutStyle }) {
    if (shotsRef.current.length === 0) return;
    const gen = (composeGen.current += 1);
    const style = patch?.frame ?? frameStyle;
    const layout = patch?.layout ?? layoutStyle;
    if (patch?.frame) setFrameStyle(patch.frame);
    if (patch?.layout) setLayoutStyle(patch.layout);
    const current = {
      ...(settings ?? DEFAULT_SETTINGS),
      frameStyle: style,
      layoutStyle: layout,
    };
    try {
      const logo = await loadRoomLogo(code, current.hasLogo);
      const strip = await composeSession(shotsRef.current, current, logo);
      if (gen !== composeGen.current) return;
      setLocalFile(strip);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(strip);
      });
      setPhoto(null);
    } catch (error) {
      if (gen !== composeGen.current) return;
      setNotice(error instanceof Error ? error.message : "A sablon nem készült el.");
    }
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
    <div className="flex h-[100dvh] w-full flex-col overflow-hidden bg-black text-white">
      <header className="flex shrink-0 items-start justify-between px-5 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <div
          onPointerDown={beginOperatorHold}
          onPointerUp={endOperatorHold}
          onPointerCancel={endOperatorHold}
          onPointerLeave={endOperatorHold}
        >
          <p className="text-xs tracking-[0.5em] text-[#c4a35a]">{title}</p>
          <p className="mt-1 text-xs text-white/50">
            {cameraOnline
              ? `${photosPerRound} fotó · ${look.label} · ${aspect.label} · ${countdownSeconds} mp`
              : "Kamera várakozik"}
            {` · ${connection}`}
          </p>
          {notice ? <p className="mt-1 text-xs text-red-300">{notice}</p> : null}
        </div>
        <div
          className={`mt-1 h-3 w-3 rounded-full ${cameraOnline ? "bg-emerald-400" : "bg-white/30"}`}
          aria-label={cameraOnline ? "Kamera csatlakozva" : "Kamera nincs csatlakozva"}
        />
      </header>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        <div
          className={`relative max-h-full max-w-full overflow-hidden ${phase === "preview" ? "hidden" : ""}`}
        >
          <video
            ref={videoRef}
            className="block max-h-full max-w-full bg-black object-contain"
            style={{
              filter: look.filter,
              aspectRatio: aspect.ratio ? String(aspect.ratio) : undefined,
              maxHeight: "100%",
            }}
            playsInline
            muted
            autoPlay
          />
          <LookOverlay look={look} />
        </div>
        {phase === "preview" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={
              previewUrl ||
              `/api/photos/${photo?.id}/file?t=${photo?.token}`
            }
            alt="Elkészült fotó"
            className="h-full w-full object-contain"
          />
        ) : null}

        {flash ? <div className="absolute inset-0 z-20 bg-white/90" /> : null}

        {phase === "countdown" && count ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
            {shotLabel ? (
              <p className="mb-2 text-sm tracking-[0.4em] text-[#c4a35a]">{shotLabel}</p>
            ) : null}
            <span className="font-serif text-[22vh] leading-none text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.35)]">
              {count}
            </span>
          </div>
        ) : null}

        {!cameraOnline && phase !== "preview" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-black/70 p-8 text-center">
            <p className="font-serif text-4xl">Kamera csatlakoztatása</p>
            <p className="max-w-md text-white/70">
              {localCamera
                ? connection && connection !== "új kapcsolat"
                  ? connection
                  : "Engedélyezd a kamerát a böngészőben."
                : "Nyisd meg az iPhone-on a kamera oldalt, és engedélyezd a kamerát."}
            </p>
            {localCamera ? null : (
              <p className="rounded-full border border-white/20 px-5 py-2 tracking-[0.4em]">
                {code}
              </p>
            )}
          </div>
        ) : null}
      </div>

      {phase === "live" && cameraOnline && !busy ? (
        <div className="shrink-0 bg-black px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2">
          <div className="flex flex-col items-center gap-2">
            <LookStrip
              stream={stream}
              poster={lookPoster}
              selectedId={look.id}
              onSelect={pickLook}
            />
            <GuestChooser
              photos={photosPerRound}
              layout={layoutStyle}
              frame={frameStyle}
              countdown={countdownSeconds}
              aspectId={aspect.id}
              onExperience={(preset) => {
                setPhotosPerRound(preset.photos);
                if (preset.photos === 1) setLayoutStyle("strip");
              }}
              onLayout={setLayoutStyle}
              onFrame={(preset) => setFrameStyle(preset.id)}
              onCountdown={setCountdownSeconds}
              onAspect={setAspect}
            />
            <KioskButton
              className="min-h-14 min-w-[14rem] text-lg"
              disabled={!cameraOnline}
              onClick={() => void startShoot()}
            >
              Fotózás
            </KioskButton>
          </div>
        </div>
      ) : null}

      {phase === "preview" && (photo || localFile) ? (
        <div className="flex shrink-0 flex-col items-center gap-2 bg-black/90 px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-2">
          <div className="flex max-w-full flex-wrap justify-center gap-1.5 overflow-x-auto">
            {shotUrls.length > 1
              ? LAYOUTS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold ${
                      layoutStyle === preset.id ? "bg-white text-black" : "bg-white/15"
                    }`}
                    onClick={() => void recompose({ layout: preset.id })}
                  >
                    {preset.label}
                  </button>
                ))
              : null}
            {FRAMES.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`min-h-10 shrink-0 rounded-full px-4 text-xs font-semibold ${
                  frameStyle === preset.id ? "bg-white text-black" : "bg-white/15"
                }`}
                onClick={() => void recompose({ frame: preset.id })}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
            <KioskButton className="min-h-12 min-w-[9rem] text-base" variant="ghost" onClick={reset}>
              Új fotó
            </KioskButton>
            <KioskButton className="min-h-12 min-w-[9rem] text-base" variant="gold" onClick={() => setShareOpen(true)}>
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
