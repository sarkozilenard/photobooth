import { del, get, set } from "idb-keyval";

const key = (code: string) => `booth-logo:${code.toUpperCase()}`;

export async function saveLocalLogo(code: string, file: Blob) {
  const compact = await shrinkLogo(file);
  await set(key(code), compact);
  return compact;
}

export async function readLocalLogo(code: string) {
  const value = await get<Blob>(key(code));
  return value && value.size > 0 ? value : null;
}

export async function deleteLocalLogo(code: string) {
  await del(key(code));
}

async function shrinkLogo(file: Blob) {
  try {
    const image = await createImageBitmap(file);
    const maxEdge = 640;
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      image.close();
      return file;
    }
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((value) => resolve(value), "image/png"),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}
