"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GuestChooser } from "@/components/booth/GuestChooser";
import { LogoPicker } from "@/components/booth/LogoPicker";
import { LookStrip } from "@/components/booth/LookGrid";
import { LookOverlay } from "@/components/booth/LookOverlay";
import { ShareSheet } from "@/components/share/ShareSheet";
import { KioskButton } from "@/components/ui/KioskButton";
import { SaveToast } from "@/components/ui/SaveToast";
import { KioskChip } from "@/components/ui/KioskChip";
import { ASPECTS, AspectPreset, FRAMES, LAYOUTS, canUseGrid } from "@/lib/booth/guest-presets";
import { countdownEndsAt, runSyncedCountdown } from "@/lib/booth/sync-countdown";
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
import { deleteLocalLogo, readLocalLogo, saveLocalLogo } from "@/lib/branding/local-logo";
import { BoothLook, DEFAULT_LOOK } from "@/lib/effects/looks";
import { createId } from "@/lib/ids";
import { uploadFinishedPhoto } from "@/lib/photos/client-upload";
import { saveAutomatically } from "@/lib/photos/queue";

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
  const [savedToast, setSavedToast] = useState<{ title: string; detail: string } | null>(null);
  const [lookPoster, setLookPoster] = useState("");
  const [camSize, setCamSize] = useState({ w: 16, h: 9 });
  const [moreOpen, setMoreOpen] = useState(false);
  const [localLogoUrl, setLocalLogoUrl] = useState<string | null>(null);
  const composeGen = useRef(0);
  const [shotUrls, setShotUrls] = useState<string[]>([]);
  const [shotLabel, setShotLabel] = useState("");
  const sessionRef = useRef(false);
  const holdPreviewRef = useRef(false);
  const shotsRef = useRef<Blob[]>([]);
  const photoRef = useRef<PhotoRecord | null>(null);
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
    let alive = true;
    let url = "";
    void readLocalLogo(code).then((blob) => {
      if (!alive || !blob) return;
      url = URL.createObjectURL(blob);
      setLocalLogoUrl(url);
    });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [code]);

  useEffect(() => {
    if (!savedToast) return;
    const id = window.setTimeout(() => setSavedToast(null), 4500);
    return () => window.clearTimeout(id);
  }, [savedToast]);

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
          if (holdPreviewRef.current || sessionRef.current) return;
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
            if (holdPreviewRef.current || sessionRef.current) return;
            void fetch(`/api/photos/${msg.photoId}?t=${msg.photoToken}`)
              .then((r) => r.json())
              .then((data) => {
                if (holdPreviewRef.current) return;
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
      setCamSize({ w: video.videoWidth, h: video.videoHeight });
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

  async function runCountdown(captureId: string, endsAt: number) {
    setPhase("countdown");
    await runSyncedCountdown(
      endsAt,
      setCount,
      soundsEnabled ? playCountdownBeep : undefined,
    );
    setCount(null);
    if (flashEnabled) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 140);
    }
    if (soundsEnabled) playShutter();
    void peerRef.current?.sendControl({ action: "capture", captureId });
    return captureCurrent(captureId);
  }

  async function startShoot() {
    if (busy || (!cameraOnline && !localCamera)) return;
    setBusy(true);
    sessionRef.current = true;
    holdPreviewRef.current = true;
    photoRef.current = null;
    setPhoto(null);
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
        const endsAt = countdownEndsAt(seconds);
        void peerRef.current?.sendControl({
          action: "start-countdown",
          captureId,
          value: seconds,
          endsAt,
        });
        const blob = await runCountdown(captureId, endsAt);
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
        holdPreviewRef.current = false;
        setNotice("A fotó nem készült el. Próbáld újra.");
        setPhase("live");
        return;
      }
      shotsRef.current = shots;
      const layout = canUseGrid(shots.length) ? layoutStyle : "strip";
      if (layout !== layoutStyle) setLayoutStyle(layout);
      const current = {
        ...(settings ?? DEFAULT_SETTINGS),
        frameStyle,
        layoutStyle: layout,
      };
      const logo = await loadRoomLogo(code, current.hasLogo, current.logoPublicPath);
      const strip = await composeSession(shots, current, logo);
      setLocalFile(strip);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(strip);
      });
      peerRef.current?.setShareFile?.(strip);
      setPhase("preview");
      try {
        await persistFinished(strip);
        setNotice("");
      } catch {
        setNotice("");
      }
    } catch (error) {
      holdPreviewRef.current = false;
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
    holdPreviewRef.current = false;
    setPhase("live");
    setPhoto(null);
    photoRef.current = null;
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
    peerRef.current?.setShareFile?.(null);
    setBusy(false);
    setCount(null);
    setShotLabel("");
    setNotice("");
    void videoRef.current?.play().catch(() => undefined);
  }

  async function persistFinished(blob: Blob, toDevices = true) {
    peerRef.current?.setShareFile?.(blob);
    if (toDevices) {
      const filename = `photobooth-${code}-${Date.now()}.jpg`;
      void saveAutomatically(blob, filename, code);
      void peerRef.current?.sendPhotoFile(blob, { action: "photo-ready" });
      setSavedToast({
        title: "Mentve az iPadre",
        detail: "Automatikus mentés, gomb nélkül.",
      });
      try {
        navigator.vibrate?.(40);
      } catch {
        /* nincs rezgés */
      }
    }
    try {
      const record = await uploadFinishedPhoto({
        file: blob,
        roomCode: code,
        photoId: photoRef.current?.id,
        token: photoRef.current?.token,
      });
      photoRef.current = record;
      setPhoto(record);
    } catch {
      /* QR a booth PeerJS-en megy, Blob nélkül */
    }
  }

  function pickLook(next: BoothLook) {
    setLook(next);
  }

  async function recompose(patch?: { frame?: FrameStyle; layout?: LayoutStyle }) {
    if (shotsRef.current.length === 0) return;
    const gen = (composeGen.current += 1);
    const style = patch?.frame ?? frameStyle;
    const layout =
      patch?.layout &&
      (patch.layout !== "grid" || canUseGrid(shotsRef.current.length))
        ? patch.layout
        : canUseGrid(shotsRef.current.length)
          ? (patch?.layout ?? layoutStyle)
          : "strip";
    if (patch?.frame) setFrameStyle(patch.frame);
    if (layout !== layoutStyle) setLayoutStyle(layout);
    const current = {
      ...(settings ?? DEFAULT_SETTINGS),
      frameStyle: style,
      layoutStyle: layout,
    };
    try {
      const logo = await loadRoomLogo(code, current.hasLogo, current.logoPublicPath);
      const strip = await composeSession(shotsRef.current, current, logo);
      if (gen !== composeGen.current) return;
      setLocalFile(strip);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return URL.createObjectURL(strip);
      });
      try {
        await persistFinished(strip, false);
      } catch (error) {
        setNotice(
          error instanceof Error
            ? error.message
            : "A kész fotó nem került a tárhelyre.",
        );
      }
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
  const photoLandscape =
    aspect.ratio != null ? aspect.ratio >= 1 : camSize.w >= camSize.h;
  const stageRatio =
    aspect.ratio && aspect.ratio > 0
      ? aspect.ratio
      : camSize.h > 0
        ? camSize.w / camSize.h
        : null;
  const liveDock = phase === "live" && cameraOnline && !busy;
  const previewLayouts = LAYOUTS.filter(
    (preset) => preset.id === "strip" || canUseGrid(shotUrls.length),
  );

  function pickPhotos(preset: { photos: number }) {
    setPhotosPerRound(preset.photos);
    if (!canUseGrid(preset.photos)) setLayoutStyle("strip");
  }

  function pickLayout(next: LayoutStyle) {
    if (next === "grid" && !canUseGrid(photosPerRound)) return;
    setLayoutStyle(next);
  }

  const chooser = (
    <GuestChooser
      photos={photosPerRound}
      layout={layoutStyle}
      frame={frameStyle}
      countdown={countdownSeconds}
      aspectId={aspect.id}
      aspectRatio={aspect.ratio}
      poster={lookPoster}
      onExperience={pickPhotos}
      onLayout={pickLayout}
      onFrame={(preset) => setFrameStyle(preset.id)}
      onCountdown={setCountdownSeconds}
      onAspect={setAspect}
    />
  );

  const liveHint = cameraOnline
    ? `${photosPerRound} fotó · ${look.label} · ${countdownSeconds} mp`
    : "Várjuk a kamerát";

  return (
    <div
      className={`relative flex h-[100dvh] w-full overflow-hidden bg-black text-white ${
        photoLandscape ? "flex-row" : "flex-col"
      }`}
    >
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      <header
        className={`z-20 flex items-center justify-between gap-3 px-4 py-3 ${
          photoLandscape
            ? "pointer-events-none absolute inset-x-0 top-0 bg-gradient-to-b from-black/70 to-transparent pt-[max(0.75rem,env(safe-area-inset-top))]"
            : "shrink-0 pt-[max(0.6rem,env(safe-area-inset-top))]"
        }`}
      >
        <div
          className="pointer-events-auto"
          onPointerDown={beginOperatorHold}
          onPointerUp={endOperatorHold}
          onPointerCancel={endOperatorHold}
          onPointerLeave={endOperatorHold}
        >
          <p className="text-[11px] font-medium tracking-[0.46em] text-accent">{title}</p>
          <p className="mt-1 text-sm text-white/75">{liveHint}</p>
          {notice ? <p className="mt-1 max-w-sm text-sm text-red-300">{notice}</p> : null}
        </div>
        <span
          className={`pointer-events-none inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-xs font-medium tracking-[0.12em] uppercase ${
            cameraOnline ? "bg-emerald-400/15 text-emerald-300" : "bg-white/10 text-white/50"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${cameraOnline ? "bg-emerald-400" : "bg-white/35"}`}
          />
          {cameraOnline ? "Élő" : "Offline"}
        </span>
      </header>

      <div className="relative flex min-h-0 min-w-0 flex-1 items-center justify-center bg-zinc-950">
        <div
          className={`relative max-h-full overflow-hidden bg-black ${phase === "preview" ? "hidden" : ""}`}
          style={
            stageRatio
              ? {
                  aspectRatio: String(stageRatio),
                  height: "100%",
                  width: "auto",
                  maxWidth: "100%",
                }
              : { height: "100%", width: "100%" }
          }
        >
          <video
            ref={videoRef}
            className={`absolute inset-0 h-full w-full bg-black ${
              aspect.ratio ? "object-cover" : "object-contain"
            }`}
            style={{ filter: look.filter }}
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
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-black/30">
            {shotLabel ? (
              <p className="mb-3 text-sm font-medium tracking-[0.35em] text-accent uppercase">
                {shotLabel}
              </p>
            ) : null}
            <span className="font-serif text-[26vh] leading-none tabular-nums text-white drop-shadow-[0_0_48px_rgba(196,163,90,0.35)]">
              {count}
            </span>
          </div>
        ) : null}

        {busy && phase !== "preview" && !count ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/35">
            <p className="rounded-full bg-black/50 px-6 py-3 text-sm tracking-[0.28em] text-accent uppercase">
              {shotLabel ? `Következik ${shotLabel}` : "Készül a fotó…"}
            </p>
          </div>
        ) : null}

        {!cameraOnline && phase !== "preview" ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-5 bg-black/75 p-8 text-center">
            <p className="font-serif text-4xl sm:text-5xl">Kamera kell</p>
            <p className="max-w-md text-base leading-relaxed text-white/70">
              {localCamera
                ? connection && connection !== "új kapcsolat"
                  ? connection
                  : "Engedélyezd a kamerát a böngészőben."
                : "Nyisd meg az iPhone-on a kamera oldalt, és engedélyezd a kamerát."}
            </p>
            {localCamera ? null : (
              <p className="rounded-full border border-white/20 bg-white/5 px-8 py-3 text-2xl tracking-[0.45em]">
                {code}
              </p>
            )}
          </div>
        ) : null}
      </div>
      </div>

      {photoLandscape && liveDock ? (
        <aside className="relative z-10 flex w-[min(28rem,40vw)] shrink-0 flex-col items-center gap-5 overflow-y-auto border-l border-white/10 bg-black px-4 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <LookStrip
            stream={stream}
            poster={lookPoster}
            selectedId={look.id}
            onSelect={pickLook}
            wrap
          />
          {chooser}
          <KioskButton
            className="mt-auto w-full min-w-0"
            disabled={!cameraOnline}
            onClick={() => void startShoot()}
          >
            Fotózás
          </KioskButton>
        </aside>
      ) : null}

      {!photoLandscape && liveDock ? (
        <div className="shrink-0 border-t border-white/10 bg-black px-3 pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))]">
          <LookStrip
            stream={stream}
            poster={lookPoster}
            selectedId={look.id}
            onSelect={pickLook}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="min-h-14 flex-1 rounded-full bg-white/10 text-sm font-semibold tracking-[0.14em] uppercase ring-1 ring-white/15"
              onClick={() => setMoreOpen(true)}
            >
              Beállítások
            </button>
            <KioskButton
              className="min-h-14 min-w-0 flex-[1.4] text-base"
              disabled={!cameraOnline}
              onClick={() => void startShoot()}
            >
              Fotózás
            </KioskButton>
          </div>
        </div>
      ) : null}

      {moreOpen && !photoLandscape && liveDock ? (
        <div className="absolute inset-0 z-30 flex flex-col justify-end bg-black/55 backdrop-blur-sm">
          <button
            type="button"
            className="min-h-12 flex-1"
            aria-label="Bezárás"
            onClick={() => setMoreOpen(false)}
          />
          <div className="max-h-[70dvh] overflow-y-auto rounded-t-[2rem] border-t border-white/10 bg-[#0b0b0b] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-[11px] font-medium tracking-[0.28em] text-accent uppercase">
                Beállítások
              </p>
              <button
                type="button"
                className="min-h-11 rounded-full bg-white px-5 text-sm font-semibold text-black"
                onClick={() => setMoreOpen(false)}
              >
                Kész
              </button>
            </div>
            {chooser}
          </div>
        </div>
      ) : null}

      {phase === "preview" && (photo || localFile) ? (
        <div
          className={`flex shrink-0 flex-col items-center gap-3 bg-black px-4 pt-3 ${
            photoLandscape
              ? "w-[min(24rem,38vw)] border-l border-white/10 pb-5"
              : "border-t border-white/10 pb-[max(1rem,env(safe-area-inset-bottom))]"
          }`}
        >
          <div className="flex max-w-full flex-wrap justify-center gap-2">
            {shotUrls.length > 1
              ? previewLayouts.map((preset) => (
                  <KioskChip
                    key={preset.id}
                    selected={layoutStyle === preset.id}
                    onClick={() => void recompose({ layout: preset.id })}
                  >
                    {preset.label}
                  </KioskChip>
                ))
              : null}
            {FRAMES.map((preset) => (
              <KioskChip
                key={preset.id}
                selected={frameStyle === preset.id}
                onClick={() => void recompose({ frame: preset.id })}
              >
                {preset.label}
              </KioskChip>
            ))}
          </div>
          <div className="flex w-full max-w-md items-center justify-center gap-3">
            <KioskButton className="min-h-14 min-w-0 flex-1" variant="ghost" onClick={reset}>
              Új fotó
            </KioskButton>
            <KioskButton
              className="min-h-14 min-w-0 flex-1"
              variant="gold"
              onClick={() => setShareOpen(true)}
            >
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
          onPhoto={(record) => {
            photoRef.current = record;
            setPhoto(record);
          }}
          onClose={() => setShareOpen(false)}
        />
      ) : null}

      {settingsOpen && settings ? (
        <div className="absolute inset-0 z-40 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div className="max-h-[88dvh] w-full max-w-lg overflow-y-auto rounded-[2rem] border border-white/10 bg-[#0c0c0c] p-6 text-white">
            <p className="text-sm tracking-[0.35em] text-accent">BOOTH</p>
            <h2 className="mt-2 font-serif text-3xl">Beállítások</h2>
            <div className="mt-6 grid gap-4">
              <label className="flex flex-col gap-2 text-sm">
                Visszaszámláló: {settings.countdownSeconds} mp
                <input
                  type="range"
                  min={1}
                  max={20}
                  value={settings.countdownSeconds}
                  className="accent-accent"
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
                  value={settings.photosPerRound}
                  className="accent-accent"
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
              <div className="flex flex-col gap-2 text-sm">
                Logó
                <LogoPicker
                  previewUrl={localLogoUrl}
                  selectedUrl={settings.logoPublicPath}
                  onUpload={(file) => {
                    void saveLocalLogo(code, file).then((blob) => {
                      setLocalLogoUrl((prev) => {
                        if (prev) URL.revokeObjectURL(prev);
                        return URL.createObjectURL(blob);
                      });
                      setSettings({
                        ...settings,
                        hasLogo: true,
                        logoPublicPath: "",
                      });
                    });
                  }}
                  onPickPublic={(item) => {
                    void fetch(item.url)
                      .then((res) => {
                        if (!res.ok) throw new Error("logo");
                        return res.blob();
                      })
                      .then((blob) => saveLocalLogo(code, blob))
                      .then((blob) => {
                        setLocalLogoUrl((prev) => {
                          if (prev) URL.revokeObjectURL(prev);
                          return URL.createObjectURL(blob);
                        });
                        setSettings({
                          ...settings,
                          hasLogo: true,
                          logoPublicPath: item.url,
                        });
                      });
                  }}
                  onClear={() => {
                    void deleteLocalLogo(code);
                    setLocalLogoUrl((prev) => {
                      if (prev) URL.revokeObjectURL(prev);
                      return null;
                    });
                    setSettings({
                      ...settings,
                      hasLogo: false,
                      logoPublicPath: "",
                    });
                  }}
                />
              </div>
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

      <SaveToast
        show={Boolean(savedToast)}
        title={savedToast?.title ?? "Mentve az iPadre"}
        detail={savedToast?.detail}
      />
    </div>
  );
}
