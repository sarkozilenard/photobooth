import { get as blobGet } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getPhoto, readLocalPhoto } from "@/lib/store";

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
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=3600",
        "Content-Disposition": `inline; filename="booth-${photo.id}.jpg"`,
      },
    });
  }

  if (photo.blobUrl) {
    const blob = await blobGet(photo.blobUrl, {
      access: "private",
      useCache: true,
    });
    if (!blob?.stream) {
      return NextResponse.json({ error: "A fájl hiányzik" }, { status: 404 });
    }
    return new NextResponse(blob.stream, {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  if (photo.dataBase64) {
    const bytes = Buffer.from(photo.dataBase64, "base64");
    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": photo.mimeType,
        "Cache-Control": "private, max-age=3600",
      },
    });
  }

  return NextResponse.json({ error: "A fájl hiányzik" }, { status: 404 });
}
