import { CaptureRequest } from "@/lib/camera/types";

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
