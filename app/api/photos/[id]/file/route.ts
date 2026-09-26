import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { fetchBoothFile } from "@/lib/blob-store";
import { getPhoto, readLocalPhoto } from "@/lib/store";

function imageResponse(body: BodyInit, mimeType: string, id: string) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": mimeType || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
      "Content-Disposition": `inline; filename="booth-${id}.jpg"`,
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const photo = await getPhoto(id);
  if (!photo) {
    return NextResponse.json({ error: "Nincs fotó" }, { status: 404 });
  }
  const token = request.nextUrl.searchParams.get("t");
  if (token !== photo.token && !(await isAdmin())) {
    return NextResponse.json({ error: "Tiltott" }, { status: 401 });
  }

  if (photo.localPath) {
    const bytes = await readLocalPhoto(photo.localPath);
    return imageResponse(new Uint8Array(bytes), photo.mimeType, photo.id);
  }

  for (const target of [photo.blobUrl, `photos/${photo.id}.jpg`]) {
    if (!target) continue;
    const blob = await fetchBoothFile(target);
    if (blob?.stream) {
      return imageResponse(blob.stream, photo.mimeType || blob.contentType || "image/jpeg", photo.id);
    }
  }

  if (photo.dataBase64) {
    const bytes = Buffer.from(photo.dataBase64, "base64");
    return imageResponse(new Uint8Array(bytes), photo.mimeType, photo.id);
  }

  return NextResponse.json({ error: "A fájl hiányzik" }, { status: 404 });
}
