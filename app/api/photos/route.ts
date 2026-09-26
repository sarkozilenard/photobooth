import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createId, createToken } from "@/lib/ids";
import {
  getSettings,
  listPhotos,
  savePhoto,
  storePhotoBytes,
  upsertRoom,
} from "@/lib/store";
import { PhotoRecord } from "@/lib/types";

export const maxDuration = 60;

const BLOB_HELP =
  "A QR-kódos feltöltéshez Vercel Blob kell. Vercel Dashboard → Storage → Create Blob Store → Connect to this project. Utána újra deploy. Helyben (npm run dev) Blob nélkül is megy.";

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }
  const room = request.nextUrl.searchParams.get("room") || undefined;
  const photos = await listPhotos(room?.toUpperCase());
  return NextResponse.json({ photos });
}

export async function POST(request: NextRequest) {
  const form = await request.formData();
  const file = form.get("file");
  const roomCode = String(form.get("roomCode") || "").toUpperCase();
  const captureId = String(form.get("captureId") || "");
  const photoId = String(form.get("photoId") || createId());

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Hiányzó fájl" }, { status: 400 });
  }
  if (!roomCode) {
    return NextResponse.json({ error: "Hiányzó booth kód" }, { status: 400 });
  }

  await upsertRoom(roomCode);

  const settings = await getSettings(roomCode);
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length > 4.2 * 1024 * 1024) {
    return NextResponse.json(
      {
        error:
          "A fotó túl nagy a feltöltéshez. Csökkentsd a JPEG minőséget a beállításokban.",
      },
      { status: 413 },
    );
  }

  const token = createToken();

  const record: PhotoRecord = {
    id: photoId,
    roomCode,
    createdAt: new Date().toISOString(),
    status: "ready",
    mimeType: file.type || "image/jpeg",
    size: bytes.length,
    token,
    captureId,
  };

  try {
    const stored = await storePhotoBytes(photoId, bytes, record.mimeType);
    record.blobUrl = stored.blobUrl;
    record.localPath = stored.localPath;
  } catch (error) {
    const message =
      error instanceof Error && error.message === "BLOB_REQUIRED"
        ? BLOB_HELP
        : "A fotó feltöltése nem sikerült.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  await savePhoto(record);
  return NextResponse.json({
    photo: record,
    quality: settings.jpegQuality,
  });
}
