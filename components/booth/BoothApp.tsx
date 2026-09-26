"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ShareSheet } from "@/components/share/ShareSheet";
import { KioskButton } from "@/components/ui/KioskButton";
import { createRingLightDriver } from "@/lib/hardware/ring-light";
import { playCountdownBeep, playShutter, resumeAudio } from "@/lib/sounds";
import { BoothSettings, DEFAULT_SETTINGS, PhotoRecord } from "@/lib/types";
import { LiveLink, startBoothLive } from "@/lib/webrtc/live";
import { attachStream, captureFromVideo, getCameraStream } from "@/lib/camera/capture";
import { composeSession, loadRoomLogo } from "@/lib/branding/compose";
import { createId } from "@/lib/ids";

type Phase = "live" | "countdown" | "preview";

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
  const [count, setCount] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const [photo, setPhoto] = useState<PhotoRecord | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localFile, setLocalFile] = useState<Blob | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [cameraOnline, setCameraOnline] = useState(localCamera);
  const [connection, setConnection] = useState("új kapcsolat");
  const [busy, setBusy] = useState(false);
  const [shotUrls, setShotUrls] = useState<string[]>([]);
  const [shotLabel, setShotLabel] = useState("");
  const sessionRef = useRef(false);
  const ring = useRef(createRingLightDriver());

  const loadSettings = useCallback(async () => {
    const res = await fetch(`/api/rooms/${code}`);
    const data = await res.json();
    setSettings(data.settings);
  }, [code]);

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
        setCameraOnline(true);
        setConnection("helyi kamera");
      })();
      return () => stream?.getTracks().forEach((track) => track.stop());
    }

    let stop: () => void = () => {};
    void (async () => {
      const peer = await startBoothLive({
        code,
        onStream: (stream) => {
          void attachStream(video, stream);
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
    return captureFromVideo(videoRef.current, {
      captureId,
      quality: settings?.jpegQuality ?? 0.92,
      maxEdge: settings?.maxEdge ?? 2560,
    });
  }

  async function runCountdown(captureId: string, seconds: number) {
    setPhase("countdown");
    for (let n = seconds; n >= 1; n -= 1) {
      setCount(n);
      if (settings?.soundsEnabled) playCountdownBeep(n);
      await new Promise((r) => setTimeout(r, 1000));
    }
    setCount(null);
    if (settings?.flashEnabled) {
      setFlash(true);
      window.setTimeout(() => setFlash(false), 140);
    }
    if (settings?.soundsEnabled) playShutter();
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

    const seconds = settings?.countdownSeconds ?? 3;
    const total = settings?.photosPerRound ?? 1;
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
      const current = settings ?? DEFAULT_SETTINGS;
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
      const data = await res.json();
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

  const title = settings?.name || "PHOTO BOOTH";

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      <div
        className={`absolute inset-0 flex items-center justify-center bg-black transition duration-500 ${
          phase === "preview" ? "opacity-0" : "opacity-100"
        }`}
      >
        <video
          ref={videoRef}
          className="h-full w-full object-contain"
          playsInline
          muted
          autoPlay
        />
      </div>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_55%,rgba(0,0,0,0.35)_100%)]" />

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

      <header className="absolute left-0 right-0 top-0 z-10 flex items-start justify-between p-6 pt-[max(1.5rem,env(safe-area-inset-top))]">
        <div>
          <p className="text-xs tracking-[0.5em] text-[#c4a35a]">{title}</p>
          <p className="mt-2 text-xs uppercase tracking-[0.25em] text-white/50">
            {cameraOnline ? "Élő kamera" : "Kamera várakozik"} · {connection}
          </p>
        </div>
        <div
          className={`h-3 w-3 rounded-full ${cameraOnline ? "bg-emerald-400" : "bg-white/30"}`}
          aria-label={cameraOnline ? "Kamera csatlakozva" : "Kamera nincs csatlakozva"}
        />
      </header>

      {!cameraOnline && phase === "live" ? (
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

      {phase === "live" && !busy ? (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center p-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
          <KioskButton
            className="min-h-20 min-w-[18rem] text-2xl"
            disabled={!cameraOnline || busy}
            onClick={() => void startShoot()}
          >
            Fotózás
          </KioskButton>
        </div>
      ) : null}

      {phase === "preview" && (photo || localFile) ? (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-center gap-4 p-8 pb-[max(2rem,env(safe-area-inset-bottom))]">
          {shotUrls.length > 1 ? (
            <div className="flex gap-2">
              {shotUrls.map((url) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="h-16 w-16 rounded-lg object-cover ring-1 ring-white/20"
                />
              ))}
            </div>
          ) : null}
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
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
    </div>
  );
}
