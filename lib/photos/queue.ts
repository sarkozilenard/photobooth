import { get, set, del, keys } from "idb-keyval";

const PREFIX = "booth-upload:";

export interface QueuedPhoto {
  id: string;
  roomCode: string;
  captureId: string;
  blob: Blob;
  createdAt: string;
  attempts: number;
}

export async function enqueuePhoto(photo: QueuedPhoto) {
  await set(`${PREFIX}${photo.id}`, photo);
}

export async function removeQueuedPhoto(id: string) {
  await del(`${PREFIX}${id}`);
}

export async function listQueuedPhotos() {
  const all = await keys();
  const photos: QueuedPhoto[] = [];
  for (const key of all) {
    if (typeof key === "string" && key.startsWith(PREFIX)) {
      const item = await get<QueuedPhoto>(key);
      if (item) photos.push(item);
    }
  }
  return photos.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function flushUploadQueue(
  uploader: (photo: QueuedPhoto) => Promise<boolean>,
) {
  const items = await listQueuedPhotos();
  for (const item of items) {
    try {
      const ok = await uploader(item);
      if (ok) await removeQueuedPhoto(item.id);
      else {
        await set(`${PREFIX}${item.id}`, {
          ...item,
          attempts: item.attempts + 1,
        });
      }
    } catch {
      await set(`${PREFIX}${item.id}`, {
        ...item,
        attempts: item.attempts + 1,
      });
    }
  }
}

function isAppleTouch() {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

export function saveToDevice(blob: Blob, filename: string) {
  const name = filename.toLowerCase().endsWith(".jpg") ? filename : `${filename}.jpg`;
  const packed = isAppleTouch()
    ? new Blob([blob], { type: "application/octet-stream" })
    : new Blob([blob], { type: blob.type || "image/jpeg" });
  const url = URL.createObjectURL(packed);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function downloadBlob(blob: Blob, filename: string) {
  saveToDevice(blob, filename);
}
