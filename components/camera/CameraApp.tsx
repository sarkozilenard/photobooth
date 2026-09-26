"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  attachStream,
  cameraErrorMessage,
  captureFromVideo,
  getCameraStream,
} from "@/lib/camera/capture";
import { createId } from "@/lib/ids";
import {
  enqueuePhoto,
  flushUploadQueue,
  QueuedPhoto,
} from "@/lib/photos/queue";
import { playCountdownBeep, playShutter, resumeAudio } from "@/lib/sounds";
import { BoothSettings } from "@/lib/types";
import { LiveLink, startCameraLive } from "@/lib/webrtc/live";

async function uploadPhoto(item: QueuedPhoto) {
  const form = new FormData();
  form.set("file", item.blob, `${item.id}.jpg`);
  form.set("roomCode", item.roomCode);
  form.set("captureId", item.captureId);
  form.set("photoId", item.id);
  const res = await fetch("/api/photos", { method: "POST", body: form });
  if (!res.ok) return null;
  return (await res.json()) as { photo: { id: string; token: string } };
}

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
    const onOnline = () => {
      void flushUploadQueue(async (item) => Boolean(await uploadPhoto(item)));
    };
    window.addEventListener("online", onOnline);
    onOnline();
    return () => window.removeEventListener("online", onOnline);
  }, []);

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
    const photoId = createId();
    const queued: QueuedPhoto = {
      id: photoId,
      roomCode: code,
      captureId,
      blob,
      createdAt: new Date().toISOString(),
      attempts: 0,
    };
    await enqueuePhoto(queued);
    try {
      const uploaded = await uploadPhoto(queued);
      const meta = {
        action: "photo-ready" as const,
        captureId,
        photoId: uploaded ? uploaded.photo.id : photoId,
        photoToken: uploaded?.photo.token,
      };
      await peerRef.current?.sendPhotoFile(blob, meta);
      if (uploaded) {
        await peerRef.current?.sendControl(meta);
      }
    } catch {
      await peerRef.current?.sendPhotoFile(blob, {
        action: "photo-ready",
        captureId,
        photoId,
      });
      setStatus("Mentve helyben, feltöltés később");
    }
  }

  async function handleControl(
    action: string,
    captureId?: string,
    value?: number,
  ) {
    const key = `${action}:${captureId ?? ""}`;
    if (seenRef.current.has(key)) return;
    seenRef.current.add(key);

    if (action === "start-countdown") {
      await resumeAudio();
      const seconds = Math.min(20, Math.max(1, value ?? 3));
      for (let n = seconds; n >= 1; n -= 1) {
        setCount(n);
        if (settings?.soundsEnabled !== false) playCountdownBeep(n);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setCount(null);
    }
    if (action === "capture" && captureId) {
      if (settings?.soundsEnabled !== false) playShutter();
      await captureStill(captureId);
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
            void handleControl(msg.action, msg.captureId, msg.value);
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
        className="absolute inset-0 h-full w-full object-contain bg-black"
        playsInline
        muted
        autoPlay
      />
      {count ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/20">
          <span className="font-serif text-[40vw]">{count}</span>
        </div>
      ) : null}
      <div className="absolute left-0 right-0 top-0 z-10 p-5 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <p className="text-xs tracking-[0.4em] text-[#c4a35a]">IPHONE KAMERA</p>
        <p className="mt-1 text-sm text-white/70">{status}</p>
      </div>
      {!ready ? (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-6 bg-black/70 p-8 text-center">
          <p className="font-serif text-4xl">Kamera</p>
          <p className="max-w-sm text-white/70">
            Engedélyezd a kamerát. Az iPad ettől a pillanattól élő képet kap.
          </p>
          <button
            className="min-h-16 rounded-full bg-white px-10 text-lg font-semibold tracking-[0.2em] text-black uppercase"
            onClick={() => void start()}
          >
            Kamera indítása
          </button>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
        </div>
      ) : (
        <div className="absolute bottom-0 left-0 right-0 z-10 flex justify-center p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <button
            className="min-h-14 rounded-full border border-white/20 bg-black/40 px-8 text-sm tracking-[0.25em] uppercase"
            onClick={() => void flip()}
          >
            Kamera váltása
          </button>
        </div>
      )}
    </div>
  );
}
