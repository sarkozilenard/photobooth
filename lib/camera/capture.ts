import { CaptureRequest } from "@/lib/camera/types";
import { bakeLook, BoothLook } from "@/lib/effects/looks";

export function cameraErrorMessage(error: unknown) {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "PermissionDeniedError") {
    return "A kamera engedélye le van tiltva. iPhone: Beállítások → Safari → Kamera → Engedélyezés, aztán frissítsd az oldalt.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "A Safari nem talál kamerát ezen az eszközön.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "A kamerát másik app használja. Zárd be a Kamerát / FaceTime-ot, és próbáld újra.";
  }
  if (error instanceof Error && error.message) return error.message;
  return "A kamera nem indult el.";
}

export async function getCameraStream(facingMode: "user" | "environment") {
  const attempts: MediaStreamConstraints[] = [
    {
      audio: false,
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 },
      },
    },
    { audio: false, video: { facingMode } },
    { audio: false, video: true },
  ];

  let last: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (error) {
      last = error;
    }
  }
  throw last instanceof Error ? last : new Error("A kamera nem elérhető");
}

export async function captureFromVideo(
  video: HTMLVideoElement,
  request: CaptureRequest,
  look?: BoothLook,
) {
  const srcW = video.videoWidth || 1280;
  const srcH = video.videoHeight || 720;
  const aspect = request.aspectRatio;
  let width: number;
  let height: number;
  if (aspect && aspect > 0) {
    if (aspect >= 1) {
      width = Math.min(request.maxEdge, 1920);
      height = Math.round(width / aspect);
    } else {
      height = Math.min(request.maxEdge, 1920);
      width = Math.round(height * aspect);
    }
  } else {
    const scale = Math.min(1, request.maxEdge / Math.max(srcW, srcH));
    width = Math.round(srcW * scale);
    height = Math.round(srcH * scale);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Nincs canvas");
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, width, height);
  const crop = Boolean(aspect && aspect > 0);
  const fit = crop
    ? Math.max(width / srcW, height / srcH)
    : Math.min(width / srcW, height / srcH);
  const dw = srcW * fit;
  const dh = srcH * fit;
  ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
  if (look) {
    try {
      bakeLook(ctx, canvas.width, canvas.height, look);
    } catch {
      ctx.filter = look.filter !== "none" ? look.filter : "none";
      ctx.drawImage(video, (width - dw) / 2, (height - dh) / 2, dw, dh);
      ctx.filter = "none";
    }
  }
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
