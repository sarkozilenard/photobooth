import { CaptureRequest } from "@/lib/camera/types";

export async function getCameraStream(facingMode: "user" | "environment") {
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: facingMode },
      width: { ideal: 1920 },
      height: { ideal: 1440 },
      frameRate: { ideal: 30 },
    },
  });
}

export async function captureFromVideo(
  video: HTMLVideoElement,
  request: CaptureRequest,
) {
  const width = video.videoWidth || 1280;
  const height = video.videoHeight || 720;
  const scale = Math.min(1, request.maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nincs canvas");
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), "image/jpeg", request.quality),
  );
  if (!blob) throw new Error("A fotó nem készült el");
  return blob;
}

export function attachStream(video: HTMLVideoElement, stream: MediaStream) {
  video.srcObject = stream;
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  return video.play().catch(() => undefined);
}
