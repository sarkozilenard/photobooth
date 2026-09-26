import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createId, createToken } from "@/lib/ids";
import {
  getPhoto,
  getSettings,
  listPhotos,
  savePhoto,
  storePhotoBytes,
  upsertRoom,
} from "@/lib/store";
import { PhotoRecord } from "@/lib/types";

export const maxDuration = 60;
export const runtime = "nodejs";

const BLOB_HELP =
  "A QR-kódos feltöltéshez Vercel Blob kell. Vercel Dashboard → Storage → Create Blob Store → Connect to this project. Utána újra deploy. Helyben (npm run dev) Blob nélkül is megy.";

function isFileBlob(value: FormDataEntryValue | null): value is File {
  return Boolean(
    value &&
      typeof value === "object" &&
      "arrayBuffer" in value &&
      typeof (value as File).arrayBuffer === "function" &&
      typeof (value as File).size === "number" &&
      (value as File).size > 0,
  );
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }
  const room = request.nextUrl.searchParams.get("room") || undefined;
  const photos = await listPhotos(room?.toUpperCase());
  return NextResponse.json({ photos });
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");
    const roomCode = String(form.get("roomCode") || "").toUpperCase();
    const captureId = String(form.get("captureId") || "");
    const photoId = String(form.get("photoId") || createId());
    const existing = await getPhoto(photoId);
    const token = String(form.get("token") || existing?.token || createToken());

    if (!isFileBlob(file)) {
      return NextResponse.json({ error: "Hiányzó vagy üres fájl" }, { status: 400 });
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

    const record: PhotoRecord = {
      id: photoId,
      roomCode,
      createdAt: existing?.createdAt || new Date().toISOString(),
      status: "ready",
      mimeType: file.type || "image/jpeg",
      size: bytes.length,
      token,
      captureId: captureId || existing?.captureId,
    };

    try {
      const stored = await storePhotoBytes(photoId, bytes, record.mimeType);
      record.blobUrl = stored.blobUrl;
      record.localPath = stored.localPath;
    } catch (error) {
      const detail =
        error instanceof Error && error.cause instanceof Error
          ? error.cause.message
          : error instanceof Error
            ? error.message
            : "";
      const missingToken =
        !process.env.BLOB_READ_WRITE_TOKEN ||
        /BLOB_REQUIRED|token|unauthorized|403|401/i.test(detail);
      const message = missingToken
        ? "A Blob store nincs csatolva, vagy nincs BLOB_READ_WRITE_TOKEN. Vercel → Storage → Blob → Connect to project, aztán Redeploy."
        : BLOB_HELP;
      return NextResponse.json({ error: message, detail }, { status: 503 });
    }

    await savePhoto(record);
    return NextResponse.json({
      photo: record,
      quality: settings.jpegQuality,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "ismeretlen hiba";
    return NextResponse.json(
      {
        error: `Feltöltés sikertelen: ${detail}`,
        detail,
      },
      { status: 500 },
    );
  }
}
