"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachStream,
  cameraErrorMessage,
  captureFromVideo,
  getCameraStream,
} from "@/lib/camera/capture";
import { countdownEndsAt, runSyncedCountdown } from "@/lib/booth/sync-countdown";
import { playCountdownBeep, playShutter, resumeAudio } from "@/lib/sounds";
import { BoothSettings } from "@/lib/types";
import { ControlPayload, LiveLink, startCameraLive } from "@/lib/webrtc/live";

export function CameraApp({ code }: { code: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const peerRef = useRef<LiveLink | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const seenRef = useRef(new Set<string>());
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Várakozás");
  const [count, setCount] = useState<number | null>(null);
  const [settings, setSettings] = useState<BoothSettings | null>(null);
  const [error, setError] = useState("");

  const loadSettings = useCallback(async () => {
    const res = await fetch(`/api/rooms/${code}`);
    if (!res.ok) {
      setError("Ez a booth kód nem létezik.");
      return;
    }
    const data = await res.json();
    setSettings(data.settings);
  }, [code]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    return () => {
      peerRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  async function captureStill(captureId: string) {
    const video = videoRef.current;
    if (!video) return;
    const blob = await captureFromVideo(video, {
      captureId,
      quality: settings?.jpegQuality ?? 0.92,
      maxEdge: settings?.maxEdge ?? 2560,
    });
    await peerRef.current?.sendPhotoFile(blob, {
      action: "photo-ready",
      captureId,
    });
  }

  async function handleControl(msg: ControlPayload) {
    const key = `${msg.action}:${msg.captureId ?? ""}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    if (msg.action === "start-countdown") {
      await resumeAudio();
      const seconds = Math.min(20, Math.max(1, msg.value ?? 3));
      const endsAt = typeof msg.endsAt === "number" ? msg.endsAt : countdownEndsAt(seconds);
      await runSyncedCountdown(
        endsAt,
        setCount,
        settings?.soundsEnabled !== false ? playCountdownBeep : undefined,
      );
      setCount(null);
    }
    if (msg.action === "capture" && msg.captureId) {
      if (settings?.soundsEnabled !== false) playShutter();
      await captureStill(msg.captureId);
    }
  }

  const startingRef = useRef(false);

  async function start() {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      setError("");
      setStatus("Kamera indítása…");
      peerRef.current?.close();
      peerRef.current = null;
      await resumeAudio();
      const stream = await getCameraStream(facing);
      streamRef.current = stream;
      if (videoRef.current) await attachStream(videoRef.current, stream);
      setReady(true);
      setStatus("Kamera él. iPad csatlakozás…");
      try {
        const peer = await startCameraLive({
          code,
          stream,
          onStatus: setStatus,
          onControl: (msg) => {
            void handleControl(msg);
          },
        });
        peerRef.current = peer;
      } catch (linkError) {
        setStatus(
          linkError instanceof Error
            ? `Kamera OK, iPad kapcsolat: ${linkError.message}`
            : "Kamera OK, az iPad még nem elérhető",
        );
      }
    } catch (error) {
      setError(cameraErrorMessage(error));
    } finally {
      startingRef.current = false;
    }
  }

  async function flip() {
    const next = facing === "user" ? "environment" : "user";
    setFacing(next);
    streamRef.current?.getTracks().forEach((track) => track.stop());
    const stream = await getCameraStream(next);
    streamRef.current = stream;
    if (videoRef.current) await attachStream(videoRef.current, stream);
    const [track] = stream.getVideoTracks();
    if (track) await peerRef.current?.replaceTrack(track);
  }

  return (
    <div className="relative h-[100dvh] w-full overflow-hidden bg-black text-white">
      <video
        ref={videoRef}
        className="absolute inset-0 h-full w-full bg-black object-contain"
        playsInline
        muted
        autoPlay
      />
      {count ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/30">
          <span className="font-serif text-[28vh] leading-none tabular-nums drop-shadow-[0_0_48px_rgba(196,163,90,0.35)]">
            {count}
          </span>
        </div>
      ) : null}
      <div className="absolute left-0 right-0 top-0 z-10 bg-gradient-to-b from-black/70 to-transparent p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-[11px] font-medium tracking-[0.4em] text-accent">IPHONE KAMERA</p>
        <p className="mt-1 text-sm text-white/75">{status}</p>
      </div>
      {!ready ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/80 p-8 text-center">
          <p className="font-serif text-5xl">Kamera</p>
          <p className="max-w-sm text-base leading-relaxed text-white/70">
            Engedélyezd a kamerát. Az iPad ettől a pillanattól élő képet kap.
          </p>
          <button
            className="min-h-16 rounded-full bg-white px-10 text-lg font-semibold tracking-[0.18em] text-black uppercase"
            onClick={() => void start()}
          >
            Kamera indítása
          </button>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center bg-gradient-to-t from-black/70 to-transparent p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            className="min-h-14 rounded-full bg-black/45 px-8 text-sm font-medium tracking-[0.22em] uppercase ring-1 ring-white/25"
            onClick={() => void flip()}
          >
            Kamera váltása
          </button>
        </div>
      )}
    </div>
  );
}
