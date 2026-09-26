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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
