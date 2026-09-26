import { PhotoRecord } from "@/lib/types";

export async function shrinkJpeg(blob: Blob, quality: number) {
  const image = await createImageBitmap(blob);
  const maxEdge = 1800;
  const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    image.close();
    return blob;
  }
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  image.close();
  const compact = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((value) => resolve(value), "image/jpeg", quality),
  );
  return compact && compact.size < blob.size ? compact : blob;
}

export async function uploadFinishedPhoto(options: {
  file: Blob;
  roomCode: string;
  photoId?: string;
  token?: string;
  captureId?: string;
}) {
  const packed =
    options.file.size > 3.2 * 1024 * 1024
      ? await shrinkJpeg(options.file, 0.72)
      : options.file;
  const upload = new File([packed], "photobooth.jpg", { type: "image/jpeg" });
  const form = new FormData();
  form.set("file", upload);
  form.set("roomCode", options.roomCode);
  if (options.captureId) form.set("captureId", options.captureId);
  if (options.photoId) form.set("photoId", options.photoId);
  if (options.token) form.set("token", options.token);
  const res = await fetch("/api/photos", { method: "POST", body: form });
  const data = (await res.json().catch(() => ({}))) as {
    photo?: PhotoRecord;
    error?: string;
  };
  if (!res.ok || !data.photo) {
    throw new Error(data.error || `A tárhelyre mentés nem sikerült (${res.status}).`);
  }
  return data.photo;
}
