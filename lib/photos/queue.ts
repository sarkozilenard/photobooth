import { get, set, del, keys } from "idb-keyval";

const PREFIX = "booth-upload:";
const ARCHIVE = "booth-archive:";

export async function archiveOnIpad(code: string, blob: Blob) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await set(`${ARCHIVE}${code.toUpperCase()}:${id}`, blob);
}

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

function clickDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 8000);
}

async function writeOpfs(blob: Blob, filename: string) {
  const storage = navigator.storage as unknown as {
    getDirectory?: () => Promise<FileSystemDirectoryHandle>;
  };
  if (typeof storage.getDirectory !== "function") return;
  const root = await storage.getDirectory();
  const dir = await root.getDirectoryHandle("photobooth", { create: true });
  const file = await dir.getFileHandle(filename, { create: true });
  const writable = await file.createWritable();
  await writable.write(blob);
  await writable.close();
}

export async function saveAutomatically(blob: Blob, filename: string, code: string) {
  const name = filename.toLowerCase().endsWith(".jpg") ? filename : `${filename}.jpg`;
  await archiveOnIpad(code, blob);
  try {
    await writeOpfs(blob, name);
  } catch {
    /* OPFS nem mindig van */
  }
  clickDownload(new Blob([blob], { type: blob.type || "image/jpeg" }), name);
  if (isAppleTouch()) {
    window.setTimeout(() => {
      clickDownload(new Blob([blob], { type: "application/octet-stream" }), name);
    }, 120);
  }
}

export function saveToDevice(blob: Blob, filename: string) {
  const name = filename.toLowerCase().endsWith(".jpg") ? filename : `${filename}.jpg`;
  clickDownload(new Blob([blob], { type: blob.type || "image/jpeg" }), name);
}

export function downloadBlob(blob: Blob, filename: string) {
  saveToDevice(blob, filename);
}
