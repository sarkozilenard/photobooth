import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { createId, createToken } from "@/lib/ids";
import { getRoom, getSettings, listPhotos, savePhoto, writeLocalPhoto } from "@/lib/store";
import { PhotoRecord } from "@/lib/types";

export const maxDuration = 60;

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
  const room = await getRoom(roomCode);
  if (!room) {
    return NextResponse.json({ error: "Nincs booth" }, { status: 404 });
  }

  const settings = await getSettings(roomCode);
  const bytes = Buffer.from(await file.arrayBuffer());
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

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`photos/${photoId}.jpg`, bytes, {
      access: "private",
      addRandomSuffix: false,
      contentType: record.mimeType,
      allowOverwrite: true,
    });
    record.blobUrl = blob.url;
  } else {
    record.localPath = await writeLocalPhoto(photoId, bytes);
  }

  await savePhoto(record);
  return NextResponse.json({
    photo: record,
    quality: settings.jpegQuality,
  });
}
